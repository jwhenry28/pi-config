import { randomUUID } from "node:crypto";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { loadSkills } from "@mariozechner/pi-coding-agent";
import type { WorkflowState } from "./types.js";
import { listWorkflows, loadWorkflowFile, validate } from "./loader.js";
import { currentStep, updateStatus, runCurrentStep, advanceToNextStep, autoAdvance, autoJump, evaluateConditions, jumpToStep, restoreOriginalModel, restoreOriginalModules, filterConditionResults, buildModuleSkillsBlock } from "./runner.js";

export default function workflowExtension(pi: ExtensionAPI) {
	const state: WorkflowState = {
		active: null,
		allSkills: [],
		cwd: "",
		advancing: false,
		savedCommandCtx: null,
		originalModelId: null,
		originalModules: null,
	};

	// --- Command ---

	pi.registerCommand("workflow", {
		description: "Run a multi-step workflow from .pi/workflows/",
		getArgumentCompletions: (prefix) => {
			const subcommands = ["continue", "status", "abort"];
			const workflows = listWorkflows(state.cwd);
			const all = [...subcommands, ...workflows];
			const filtered = all.filter((s) => s.startsWith(prefix));
			return filtered.length > 0 ? filtered.map((s) => ({ value: s, label: s })) : null;
		},
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			state.savedCommandCtx = ctx;

			if (trimmed === "continue") {
				if (!state.active) {
					ctx.ui.notify("No workflow is running", "warning");
					return;
				}
				const step = currentStep(state);
				if (!step?.approval) {
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
				const approvalStr = step.approval ? " (awaiting approval)" : "";
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

			const spaceIdx = trimmed.indexOf(" ");
			if (spaceIdx === -1) {
				ctx.ui.notify("Usage: /workflow <name> <prompt>", "warning");
				return;
			}
			const workflowName = trimmed.slice(0, spaceIdx);
			const userPrompt = trimmed.slice(spaceIdx + 1).trim();
			if (!userPrompt) {
				ctx.ui.notify("Usage: /workflow <name> <prompt>", "warning");
				return;
			}

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
			state.active = { id: randomUUID(), config, userPrompt, currentStepIndex: 0 };
			ctx.ui.notify(`Starting workflow "${config.name}" (${config.steps.length} steps)`, "info");
			await runCurrentStep(pi, state, ctx);
		},
	});

	// --- Events ---

	pi.on("session_start", async (_event, ctx) => {
		state.cwd = ctx.cwd;
		const result = loadSkills({ cwd: state.cwd });
		state.allSkills = result.skills;
	});

	pi.on("context", async (event) => {
		return filterConditionResults(event);
	});

	pi.on("before_agent_start", async (event) => {
		if (!state.active) return;
		const step = currentStep(state);
		if (!step) return;

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

		if (step.conditions?.length) {
			const condResult = await evaluateConditions(pi, state, ctx);
			if (!condResult) {
				const name = state.active!.config.name;
				state.active = null;
				updateStatus(state, ctx);
				await restoreOriginalModules(pi, state);
				await restoreOriginalModel(pi, state, ctx);
				ctx.ui.notify(`Workflow "${name}" aborted: condition evaluation failed`, "error");
				return;
			}
			if (condResult.jump) {
				jumpToStep(state, condResult.jump);
				await autoJump(pi, state, ctx);
			} else if (step.approval) {
				ctx.ui.notify(`Step "${step.name}" complete. Use \`/workflow continue\` when ready.`, "info");
			} else {
				await autoAdvance(pi, state, ctx);
			}
		} else if (step.approval) {
			ctx.ui.notify(`Step "${step.name}" complete. Use \`/workflow continue\` when you are ready.`, "info");
		} else {
			await autoAdvance(pi, state, ctx);
		}
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
