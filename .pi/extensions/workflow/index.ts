import { randomUUID } from "node:crypto";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { loadSkills } from "@mariozechner/pi-coding-agent";
import type { WorkflowState } from "./types.js";
import { isPromptStep } from "./types.js";
import { listWorkflows, loadWorkflowFile, validate } from "./loader.js";
import { completeNames } from "../shared/yaml-files.js";
import { currentStep, updateStatus, runCurrentStep, advanceToNextStep, autoAdvance, restoreOriginalModel, restoreOriginalModules, filterToCurrentStep, buildModuleSkillsBlock, handlePostStep, evaluateConditions, jumpToStep, autoJump, isMaxExecutionsReached } from "./runner.js";
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

	// --- Command ---

	pi.registerCommand("workflow", {
		description: "Run a multi-step workflow from .pi/workflows/",
		getArgumentCompletions: (prefix) => {
			const subcommands = ["continue", "status", "abort"];
			const workflows = listWorkflows(state.cwd);
			const allNames = [...subcommands, ...workflows];
			return completeNames(prefix, allNames);
		},
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			state.savedCommandCtx = ctx;

			if (trimmed === "continue") {
				if (!state.active) {
					ctx.ui.notify("No workflow is running", "warning");
					return;
				}

				// If a condition is pending, resume condition evaluation
				if (state.pendingConditionIndex !== null) {
					state.savedCommandCtx = ctx;
					const condResult = await evaluateConditions(pi, state, ctx);
					if (condResult === "paused") {
						// Still paused — user needs to /evaluate-condition first
						return;
					}
					if (!condResult) {
						const name = state.active!.config.name;
						state.active = null;
						updateStatus(state, ctx);
						await restoreOriginalModules(pi, state);
						await restoreOriginalModel(pi, state, ctx);
						ctx.ui.notify(`Workflow "${name}" aborted: condition evaluation failed`, "error");
						return;
					}
					// condResult has a jump
					if (condResult.jump) {
						if (isMaxExecutionsReached(state, condResult.jump)) {
							const targetStep = state.active!.config.steps.find(s => s.name === condResult.jump)!;
							ctx.ui.notify(`[Workflow] Step "${condResult.jump}" reached maxExecutions limit (${targetStep.maxExecutions}), advancing sequentially`, "warning");
							await advanceToNextStep(pi, state, ctx);
						} else {
							jumpToStep(state, condResult.jump);
							await autoJump(pi, state, ctx);
						}
					} else {
						await advanceToNextStep(pi, state, ctx);
					}
					return;
				}

				const step = currentStep(state);
				if (!step || !isPromptStep(step) || !step.approval) {
					ctx.ui.notify("Current step does not require approval", "warning");
					return;
				}
				ctx.ui.notify(`✓ Step "${step.name}" approved`, "info");
				await advanceToNextStep(pi, state, ctx);
				return;
			}

			if (trimmed === "status") {
				if (!state.active) {
					ctx.ui.notify("No workflow is running", "info");
					return;
				}
				const step = currentStep(state)!;
				const total = state.active.config.steps.length;
				const idx = state.active.currentStepIndex + 1;
				const approvalStr = isPromptStep(step) && step.approval ? " (awaiting approval)" : "";
				ctx.ui.notify(`${state.active.config.name} — Step ${idx}/${total}: ${step.name}${approvalStr}`, "info");
				return;
			}

			if (trimmed === "abort") {
				if (!state.active) {
					ctx.ui.notify("No workflow is running", "warning");
					return;
				}
				const name = state.active.config.name;
				state.active = null;
				updateStatus(state, ctx);
				await restoreOriginalModules(pi, state);
				await restoreOriginalModel(pi, state, ctx);
				ctx.ui.notify(`Workflow "${name}" aborted`, "info");
				return;
			}

			// Start a workflow: /workflow <name> <prompt>
			if (state.active) {
				ctx.ui.notify(`Workflow "${state.active.config.name}" is already running. Use /workflow abort first.`, "warning");
				return;
			}

			const wsMatch = trimmed.match(/\s/);
			const wsIdx = wsMatch ? wsMatch.index! : -1;
			const workflowName = wsIdx === -1 ? trimmed : trimmed.slice(0, wsIdx);
			const userPrompt = wsIdx === -1 ? "" : trimmed.slice(wsIdx + 1).trim();

			let config;
			try {
				config = loadWorkflowFile(workflowName, state.cwd);
			} catch (e: unknown) {
				ctx.ui.notify(`${(e as Error).message}`, "error");
				return;
			}

			// Query modules extension for known modules and current shown state
			let knownModules: Set<string> | undefined;
			let currentShownModules: string[] = [];
			pi.events.emit("module:get-state", {
				callback: (info: { shown: string[]; modules: Map<string, unknown> }) => {
					knownModules = new Set(info.modules.keys());
					currentShownModules = info.shown;
				},
			});

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
		},
	});

	pi.registerCommand("evaluate-condition", {
		description: "Manually evaluate a workflow condition: /evaluate-condition <true/false> <explanation>",
		handler: async (args, ctx) => {
			if (!state.active) {
				ctx.ui.notify("No workflow is running", "warning");
				return;
			}
			if (state.pendingConditionIndex === null) {
				ctx.ui.notify("No condition is pending evaluation", "warning");
				return;
			}

			const trimmed = args.trim();
			const spaceIdx = trimmed.indexOf(" ");
			const resultStr = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
			const explanation = spaceIdx === -1 ? "Manual evaluation" : trimmed.slice(spaceIdx + 1).trim();

			if (resultStr !== "true" && resultStr !== "false") {
				ctx.ui.notify('Usage: /evaluate-condition <true/false> <explanation>', "warning");
				return;
			}

			writeKey(state.cwd, state.active.id, "workflow-condition-result",
				JSON.stringify({ result: resultStr, explanation }));

			ctx.ui.notify(`Condition manually evaluated: ${resultStr} — ${explanation}`, "info");
			ctx.ui.notify('Use `/workflow continue` to resume the workflow.', "info");
		},
	});

	// --- Events ---

	pi.on("session_start", async (_event, ctx) => {
		state.cwd = ctx.cwd;
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

		// Replace the full <available_skills> block with one derived from the step's effective modules
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
		const name = state.active.config.name;
		state.active = null;
		updateStatus(state, ctx);
		await restoreOriginalModules(pi, state);
		await restoreOriginalModel(pi, state, ctx);
		ctx.ui.notify(`Workflow "${name}" aborted (session switched)`, "warning");
	});
}
