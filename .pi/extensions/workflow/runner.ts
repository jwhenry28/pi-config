import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext, ExtensionCommandContext, ContextEvent } from "@mariozechner/pi-coding-agent";
import type { WorkflowStep, WorkflowState } from "./types.js";
import { resolvePrompt } from "./loader.js";
import { evaluateCondition } from "./evaluator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function createMemoryDomain(cwd: string, domain: string): void {
	const dir = join(cwd, ".pi", "memory");
	const filePath = join(dir, `${domain}.json`);
	if (existsSync(filePath)) return;
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const ts = new Date().toISOString();
	writeFileSync(filePath, JSON.stringify({
		metadata: { created: ts, last_updated: ts, last_visited: ts },
		entries: {},
	}, null, 2), "utf-8");
}
const messageTemplate = readFileSync(join(__dirname, "step-message.md"), "utf-8");

export async function restoreOriginalModel(pi: ExtensionAPI, state: WorkflowState, ctx: ExtensionContext): Promise<void> {
	if (!state.originalModelId) return;
	const model = ctx.modelRegistry.getAll().find((m) => m.id === state.originalModelId);
	if (model) await pi.setModel(model);
	state.originalModelId = null;
}

export function currentStep(state: WorkflowState): WorkflowStep | null {
	if (!state.active) return null;
	return state.active.config.steps[state.active.currentStepIndex] ?? null;
}

export function updateStatus(state: WorkflowState, ctx: ExtensionContext): void {
	if (!state.active) {
		ctx.ui.setStatus("workflow", undefined);
		return;
	}
	const step = currentStep(state)!;
	const total = state.active.config.steps.length;
	const idx = state.active.currentStepIndex + 1;
	ctx.ui.setStatus("workflow", ctx.ui.theme.fg("accent", `⚡ ${state.active.config.name} [${idx}/${total}] ${step.name}`));
}

function injectSkills(pi: ExtensionAPI, step: WorkflowStep, state: WorkflowState): void {
	const stepSkills = step.skills ?? [];
	for (const name of stepSkills) {
		const skill = state.allSkills.find((s) => s.name === name);
		if (!skill) continue;
		const content = readFileSync(skill.filePath, "utf-8");
		pi.sendMessage({
			customType: "workflow:skill",
			content: `<skill name="${skill.name}" location="${skill.filePath}">\n${content}\n</skill>`,
			display: true,
			details: { skillName: skill.name, location: skill.filePath },
		});
	}
}

function buildMessage(step: WorkflowStep, resolvedPrompt: string, workflowId: string, workflowName: string, userPrompt: string): string {
	return messageTemplate
		.replaceAll("%WORKFLOW_ID%", workflowId)
		.replaceAll("%WORKFLOW_NAME%", workflowName)
		.replaceAll("%WORKFLOW_PROMPT%", userPrompt)
		.replaceAll("%STEP_NAME%", step.name)
		.replaceAll("%STEP_PROMPT%", resolvedPrompt);
}

async function applyStepModel(pi: ExtensionAPI, step: WorkflowStep, ctx: ExtensionContext): Promise<boolean> {
	const model = ctx.modelRegistry.getAll().find((m) => m.id === step.model);
	if (!model) {
		ctx.ui.notify(`Model "${step.model}" not found`, "error");
		return false;
	}
	const success = await pi.setModel(model);
	if (!success) {
		ctx.ui.notify(`Failed to set model "${step.model}" — no API key?`, "error");
		return false;
	}
	return true;
}

export async function runCurrentStep(pi: ExtensionAPI, state: WorkflowState, ctx: ExtensionContext): Promise<void> {
	if (!state.active) return;
	const step = currentStep(state)!;

	updateStatus(state, ctx);

	if (state.active.currentStepIndex === 0) {
		createMemoryDomain(state.cwd, state.active.id);
	}

	const ok = await applyStepModel(pi, step, ctx);
	if (!ok) {
		state.active = null;
		updateStatus(state, ctx);
		return;
	}

	injectSkills(pi, step, state);
	const resolvedPrompt = resolvePrompt(step.prompt, state.cwd);
	const message = buildMessage(step, resolvedPrompt, state.active.id, state.active.config.name, state.active.userPrompt);
	pi.sendUserMessage(message);
}

function notifyStepTransition(state: WorkflowState, ctx: ExtensionContext, prevStepName: string): void {
	const next = currentStep(state)!;
	ctx.ui.notify(`✓ ${prevStepName} done. Proceeding to ${next.name}, using model ${next.model}.`, "info");
}

async function completeWorkflow(pi: ExtensionAPI, state: WorkflowState, ctx: ExtensionContext, prevStepName?: string): Promise<void> {
	const suffix = prevStepName ? ` (${prevStepName} done)` : "";
	ctx.ui.notify(`✅ Workflow "${state.active!.config.name}" complete!${suffix}`, "info");
	state.active = null;
	updateStatus(state, ctx);
	state.advancing = false;
	await restoreOriginalModel(pi, state, ctx);
}

/** Advance via command context (from /workflow approve). */
export async function advanceToNextStep(pi: ExtensionAPI, state: WorkflowState, ctx: ExtensionCommandContext): Promise<void> {
	if (!state.active) return;
	state.advancing = true;

	const prevName = currentStep(state)!.name;
	state.active.currentStepIndex++;
	if (state.active.currentStepIndex >= state.active.config.steps.length) {
		await completeWorkflow(pi, state, ctx, prevName);
		return;
	}

	notifyStepTransition(state, ctx, prevName);
	updateStatus(state, ctx);

	await ctx.waitForIdle();
	await ctx.newSession();
	state.advancing = false;
	await runCurrentStep(pi, state, ctx);
}

export function jumpToStep(state: WorkflowState, stepName: string): boolean {
	if (!state.active) return false;
	const idx = state.active.config.steps.findIndex((s) => s.name === stepName);
	if (idx === -1) return false;
	state.active.currentStepIndex = idx;
	return true;
}

export async function evaluateConditions(
	pi: ExtensionAPI,
	state: WorkflowState,
	ctx: ExtensionContext,
): Promise<{ jump: string } | null> {
	const step = currentStep(state);
	if (!step?.conditions?.length) return null;

	const total = step.conditions.length;
	for (let i = 0; i < total; i++) {
		const cond = step.conditions[i];
		ctx.ui.notify(`Evaluating condition ${i + 1}/${total}: "${cond.prompt.slice(0, 60)}..."`, "info");

		const result = await evaluateCondition(cond, state.cwd, ctx);

		if (!result) {
			// Retries exhausted — abort
			return null;
		}

		ctx.ui.notify(`Condition ${i + 1}: ${result.result} — ${result.explanation}`, "info");

		pi.sendMessage({
			customType: "workflow:condition-result",
			content: `**Condition ${i + 1}/${total}** — \`${cond.prompt.slice(0, 80)}${cond.prompt.length > 80 ? "..." : ""}\`\n\n**Result:** ${result.result}\n**Explanation:** ${result.explanation}`,
			display: true,
			details: { conditionIndex: i, result: result.result, explanation: result.explanation },
		});

		if (result.result === "yes") {
			return { jump: cond.jump };
		}
	}

	// No conditions matched — sequential advance
	return { jump: "" };
}

/** Jump to a named step from agent_end (index already set by jumpToStep). */
export async function autoJump(pi: ExtensionAPI, state: WorkflowState, ctx: ExtensionContext): Promise<void> {
	if (!state.active || !state.savedCommandCtx) return;
	state.advancing = true;

	const step = currentStep(state)!;
	ctx.ui.notify(`Jumping to step "${step.name}"`, "info");
	updateStatus(state, ctx);

	const cmdCtx = state.savedCommandCtx;
	setTimeout(async () => {
		try {
			await cmdCtx.waitForIdle();
			await cmdCtx.newSession();
			state.advancing = false;
			await runCurrentStep(pi, state, cmdCtx);
		} catch (e) {
			ctx.ui.notify(`Workflow jump failed: ${(e as Error).message}`, "error");
			state.active = null;
			state.advancing = false;
			updateStatus(state, ctx);
		}
	}, 0);
}

/** Auto-advance from agent_end (no command context available directly). */
export function filterConditionResults(event: ContextEvent): { messages: typeof event.messages } | undefined {
	const filtered = event.messages.filter(
		(m: any) => !(m.role === "custom" && m.customType === "workflow:condition-result"),
	);
	if (filtered.length !== event.messages.length) {
		return { messages: filtered };
	}
	return undefined;
}

export async function autoAdvance(pi: ExtensionAPI, state: WorkflowState, ctx: ExtensionContext): Promise<void> {
	if (!state.active || !state.savedCommandCtx) return;
	state.advancing = true;

	const prevName = currentStep(state)!.name;
	state.active.currentStepIndex++;
	if (state.active.currentStepIndex >= state.active.config.steps.length) {
		await completeWorkflow(pi, state, ctx, prevName);
		return;
	}

	notifyStepTransition(state, ctx, prevName);
	updateStatus(state, ctx);

	const cmdCtx = state.savedCommandCtx;
	setTimeout(async () => {
		try {
			await cmdCtx.waitForIdle();
			await cmdCtx.newSession();
			state.advancing = false;
			await runCurrentStep(pi, state, cmdCtx);
		} catch (e) {
			ctx.ui.notify(`Workflow advance failed: ${(e as Error).message}`, "error");
			state.active = null;
			state.advancing = false;
			updateStatus(state, ctx);
		}
	}, 0);
}
