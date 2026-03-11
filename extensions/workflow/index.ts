import { randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { loadSkills } from "@mariozechner/pi-coding-agent";
import { getCwd } from "../shared/cwd.js";
import type { WorkflowState } from "./types.js";
import { isPromptStep } from "./types.js";
import { listWorkflows, loadWorkflowFile, validate } from "./loader.js";
import { completeNames } from "../shared/yaml-files.js";
import {
	currentStep,
	updateStatus,
	runCurrentStep,
	advanceToNextStep,
	restoreOriginalModel,
	restoreOriginalModules,
	filterToCurrentStep,
	buildModuleSkillsBlock,
	handlePostStep,
	evaluateConditions,
	jumpToStep,
	autoJump,
	isMaxExecutionsReached,
} from "./runner.js";
import { writeKey } from "../memory/store.js";
import "./commands/check-todos-complete.js";

export default function workflowExtension(pi: ExtensionAPI) {
	const state: WorkflowState = {
		active: null,
		allSkills: [],
		cwd: "",
		advancing: false,
		savedCommandCtx: null,
		originalModelId: null,
		originalModules: null,
		pendingConditionIndex: null,
	};

	registerWorkflowCommand(pi, state);
	registerEvaluateConditionCommand(pi, state);
	registerWorkflowEvents(pi, state);
}

function registerWorkflowCommand(pi: ExtensionAPI, state: WorkflowState): void {
	pi.registerCommand("workflow", {
		description: "Run a multi-step workflow from .pi/workflows/",
		getArgumentCompletions: (prefix) => {
			const subcommands = ["continue", "status", "abort"];
			const workflows = listWorkflows(state.cwd);
			const allNames = [...subcommands, ...workflows];
			return completeNames(prefix, allNames);
		},
		handler: async (args, ctx) => {
			await handleWorkflowCommand(pi, state, args, ctx);
		},
	});
}

async function handleWorkflowCommand(
	pi: ExtensionAPI,
	state: WorkflowState,
	args: string,
	ctx: ExtensionCommandContext,
): Promise<void> {
	const trimmedArgs = args.trim();
	state.savedCommandCtx = ctx;

	if (trimmedArgs === "continue") {
		await handleWorkflowContinue(pi, state, ctx);
		return;
	}

	if (trimmedArgs === "status") {
		handleWorkflowStatus(state, ctx);
		return;
	}

	if (trimmedArgs === "abort") {
		await handleWorkflowAbort(pi, state, ctx, "aborted", "info");
		return;
	}

	await handleWorkflowStart(pi, state, trimmedArgs, ctx);
}

async function handleWorkflowContinue(
	pi: ExtensionAPI,
	state: WorkflowState,
	ctx: ExtensionCommandContext,
): Promise<void> {
	if (!state.active) {
		ctx.ui.notify("No workflow is running", "warning");
		return;
	}

	if (state.pendingConditionIndex !== null) {
		await handlePendingConditionContinue(pi, state, ctx);
		return;
	}

	const step = currentStep(state);
	if (!step || !isPromptStep(step) || !step.approval) {
		ctx.ui.notify("Current step does not require approval", "warning");
		return;
	}

	ctx.ui.notify(`✓ Step "${step.name}" approved`, "info");
	await advanceToNextStep(pi, state, ctx);
}

async function handlePendingConditionContinue(
	pi: ExtensionAPI,
	state: WorkflowState,
	ctx: ExtensionCommandContext,
): Promise<void> {
	state.savedCommandCtx = ctx;
	const conditionResult = await evaluateConditions(pi, state, ctx);

	if (conditionResult === "paused") {
		return;
	}

	if (!conditionResult) {
		await handleWorkflowAbort(pi, state, ctx, "aborted: condition evaluation failed", "error");
		return;
	}

	if (!conditionResult.jump) {
		await advanceToNextStep(pi, state, ctx);
		return;
	}

	if (isMaxExecutionsReached(state, conditionResult.jump)) {
		const targetStep = state.active!.config.steps.find((step) => step.name === conditionResult.jump)!;
		ctx.ui.notify(
			`[Workflow] Step "${conditionResult.jump}" reached maxExecutions limit (${targetStep.maxExecutions}), advancing sequentially`,
			"warning",
		);
		await advanceToNextStep(pi, state, ctx);
		return;
	}

	jumpToStep(state, conditionResult.jump);
	await autoJump(pi, state, ctx);
}

function handleWorkflowStatus(state: WorkflowState, ctx: ExtensionCommandContext): void {
	if (!state.active) {
		ctx.ui.notify("No workflow is running", "info");
		return;
	}

	const step = currentStep(state)!;
	const totalSteps = state.active.config.steps.length;
	const stepIndex = state.active.currentStepIndex + 1;
	const approvalSuffix = isPromptStep(step) && step.approval ? " (awaiting approval)" : "";
	ctx.ui.notify(`${state.active.config.name} — Step ${stepIndex}/${totalSteps}: ${step.name}${approvalSuffix}`, "info");
}

async function handleWorkflowAbort(
	pi: ExtensionAPI,
	state: WorkflowState,
	ctx: ExtensionCommandContext,
	reason: string,
	level: "info" | "warning" | "error",
): Promise<void> {
	if (!state.active) {
		ctx.ui.notify("No workflow is running", "warning");
		return;
	}

	const workflowName = state.active.config.name;
	state.active = null;
	updateStatus(state, ctx);
	await restoreOriginalModules(pi, state);
	await restoreOriginalModel(pi, state, ctx);
	ctx.ui.notify(`Workflow "${workflowName}" ${reason}`, level);
}

async function handleWorkflowStart(
	pi: ExtensionAPI,
	state: WorkflowState,
	trimmedArgs: string,
	ctx: ExtensionCommandContext,
): Promise<void> {
	if (state.active) {
		ctx.ui.notify(`Workflow "${state.active.config.name}" is already running. Use /workflow abort first.`, "warning");
		return;
	}

	const { workflowName, userPrompt } = parseWorkflowStartArgs(trimmedArgs);

	let config;
	try {
		config = loadWorkflowFile(workflowName, state.cwd);
	} catch (error: unknown) {
		ctx.ui.notify((error as Error).message, "error");
		return;
	}

	const { knownModules, currentShownModules } = getModuleState(pi);
	const validationError = validate(config, state.cwd, state.allSkills, ctx, knownModules);
	if (validationError) {
		ctx.ui.notify(validationError, "error");
		return;
	}

	state.originalModelId = ctx.model?.id ?? null;
	state.originalModules = currentShownModules;
	state.active = { id: randomUUID(), config, userPrompt, currentStepIndex: 0, executionCounts: {} };
	ctx.ui.notify(`Starting workflow "${config.name}" (${config.steps.length} steps)`, "info");
	await runCurrentStep(pi, state, ctx);
}

function parseWorkflowStartArgs(trimmedArgs: string): { workflowName: string; userPrompt: string } {
	const firstWhitespaceMatch = trimmedArgs.match(/\s/);
	const firstWhitespaceIndex = firstWhitespaceMatch ? firstWhitespaceMatch.index! : -1;
	const workflowName = firstWhitespaceIndex === -1 ? trimmedArgs : trimmedArgs.slice(0, firstWhitespaceIndex);
	const userPrompt = firstWhitespaceIndex === -1 ? "" : trimmedArgs.slice(firstWhitespaceIndex + 1).trim();
	return { workflowName, userPrompt };
}

function getModuleState(pi: ExtensionAPI): { knownModules: Set<string> | undefined; currentShownModules: string[] } {
	let knownModules: Set<string> | undefined;
	let currentShownModules: string[] = [];

	pi.events.emit("module:get-state", {
		callback: (info: { shown: string[]; modules: Map<string, unknown> }) => {
			knownModules = new Set(info.modules.keys());
			currentShownModules = info.shown;
		},
	});

	return { knownModules, currentShownModules };
}

function registerEvaluateConditionCommand(pi: ExtensionAPI, state: WorkflowState): void {
	pi.registerCommand("evaluate-condition", {
		description: "Manually evaluate a workflow condition: /evaluate-condition <true/false> <explanation>",
		handler: async (args, ctx) => {
			handleEvaluateConditionCommand(state, args, ctx);
		},
	});
}

function handleEvaluateConditionCommand(state: WorkflowState, args: string, ctx: ExtensionCommandContext): void {
	if (!state.active) {
		ctx.ui.notify("No workflow is running", "warning");
		return;
	}

	if (state.pendingConditionIndex === null) {
		ctx.ui.notify("No condition is pending evaluation", "warning");
		return;
	}

	const trimmedArgs = args.trim();
	const firstSpaceIndex = trimmedArgs.indexOf(" ");
	const result = firstSpaceIndex === -1 ? trimmedArgs : trimmedArgs.slice(0, firstSpaceIndex);
	const explanation = firstSpaceIndex === -1 ? "Manual evaluation" : trimmedArgs.slice(firstSpaceIndex + 1).trim();

	if (result !== "true" && result !== "false") {
		ctx.ui.notify("Usage: /evaluate-condition <true/false> <explanation>", "warning");
		return;
	}

	writeKey(
		state.cwd,
		state.active.id,
		"workflow-condition-result",
		JSON.stringify({ result, explanation }),
	);

	ctx.ui.notify(`Condition manually evaluated: ${result} — ${explanation}`, "info");
	ctx.ui.notify("Use `/workflow continue` to resume the workflow.", "info");
}

function registerWorkflowEvents(pi: ExtensionAPI, state: WorkflowState): void {
	pi.on("session_start", async (_event, ctx) => {
		state.cwd = getCwd(ctx);
		const result = loadSkills({ cwd: state.cwd });
		state.allSkills = result.skills;
	});

	pi.on("context", async (event) => {
		return filterToCurrentStep(event, state);
	});

	pi.on("before_agent_start", async (event) => {
		if (!state.active) return;
		const step = currentStep(state);
		if (!step || !isPromptStep(step)) return;

		const moduleSkills = buildModuleSkillsBlock(pi, state.active.config, step);
		const cleaned = event.systemPrompt.replace(/<available_skills>[\s\S]*?<\/available_skills>/g, moduleSkills);
		return { systemPrompt: cleaned };
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (!state.active) return;
		if (state.advancing) return;
		const step = currentStep(state);
		if (!step) return;

		await handlePostStep(pi, state, ctx, step);
	});

	pi.on("session_before_switch", async (_event, ctx) => {
		if (!state.active) return;
		if (state.advancing) return;
		await handleWorkflowAbort(pi, state, ctx, "aborted (session switched)", "warning");
	});
}
