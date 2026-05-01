import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
  ContextEvent,
} from "@mariozechner/pi-coding-agent";
import type {
  WorkflowConfig,
  WorkflowStep,
  WorkflowState,
  PromptStep,
  CommandStep,
} from "./types.js";
import {
  isPromptStep,
  isCommandStep,
  isPromptCondition,
  isCommandCondition,
} from "./types.js";
import { resolvePrompt } from "./loader.js";
import { evaluateCondition, evaluateCommandCondition } from "./evaluator.js";
import { resolveModelAlias, parseModelRef } from "./models.js";
import { getStepCommand } from "./commands/registry.js";
import { readKey, deleteEntry } from "../memory/store.js";
import {
  isPluginSkillRef,
  resolvePluginSkillPath,
  parseSkillName,
} from "./plugin-skills.js";
import { createDiagnostics, completeDiagnostics, recordStepUsage, type TokenUsage } from "./diagnostics.js";
import { createMemoryDomain, getWorkflowPrompt } from "./prompt-memory.js";
import { computeActiveTools } from "../modules/state.js";
import type { ModuleContents } from "../modules/registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const messageTemplate = readFileSync(
  join(__dirname, "prompts", "step-message.md"),
  "utf-8",
);

export async function restoreOriginalModel(
  pi: ExtensionAPI,
  state: WorkflowState,
  ctx: ExtensionContext,
): Promise<void> {
  if (!state.originalModelId) return;
  const model = ctx.modelRegistry
    .getAll()
    .find((m) => m.id === state.originalModelId);
  if (model) await pi.setModel(model);
  state.originalModelId = null;
}

export function restoreOriginalThinkingLevel(
  pi: ExtensionAPI,
  state: WorkflowState,
): void {
  if (!state.originalThinkingLevel) return;
  pi.setThinkingLevel(state.originalThinkingLevel);
  state.originalThinkingLevel = null;
}

export function computeEffectiveModules(
  config: WorkflowConfig,
  step: PromptStep,
): string[] {
  const workflowModules = normalizeModules(config.modules);
  const stepModules = normalizeModules(step.modules);
  return [...new Set([...workflowModules, ...stepModules])];
}

function normalizeModules(modules: string[] | string | undefined): string[] {
  if (!modules) return [];
  if (Array.isArray(modules)) return modules;
  return [modules];
}

export function captureActiveTools(pi: ExtensionAPI): string[] {
  const { shown, modules } = getModuleState(pi);
  return computeToolsForModules(pi, modules, shown);
}

export function applyStepModules(
  pi: ExtensionAPI,
  config: WorkflowConfig,
  step: PromptStep,
): void {
  const effective = computeEffectiveModules(config, step);
  const { modules } = getModuleState(pi);
  pi.setActiveTools(computeToolsForModules(pi, modules, effective));
}

export async function restoreOriginalActiveTools(
  pi: ExtensionAPI,
  state: WorkflowState,
): Promise<void> {
  if (!state.originalActiveTools) return;
  pi.setActiveTools(state.originalActiveTools);
  state.originalActiveTools = null;
}

function getModuleState(pi: ExtensionAPI): { shown: string[]; modules: Map<string, ModuleContents> } {
  let shown: string[] = [];
  let modules: Map<string, ModuleContents> = new Map();

  pi.events.emit("module:get-state", {
    callback: (info: { shown: string[]; modules: Map<string, ModuleContents> }) => {
      shown = info.shown;
      modules = info.modules;
    },
  });

  return { shown, modules };
}

function computeToolsForModules(
  pi: ExtensionAPI,
  modules: Map<string, ModuleContents>,
  shownModules: string[],
): string[] {
  const allToolNames = pi.getAllTools().map((t) => t.name);
  return computeActiveTools(allToolNames, modules, { shown: shownModules, granular: {} });
}

export function currentStep(state: WorkflowState): WorkflowStep | null {
  if (!state.active) return null;
  return state.active.config.steps[state.active.currentStepIndex] ?? null;
}

export function updateStatus(
  state: WorkflowState,
  ctx: ExtensionContext,
): void {
  if (!state.active) {
    ctx.ui.setStatus("workflow", undefined);
    return;
  }
  const step = currentStep(state)!;
  const total = state.active.config.steps.length;
  const idx = state.active.currentStepIndex + 1;
  ctx.ui.setStatus(
    "workflow",
    ctx.ui.theme.fg(
      "accent",
      `⚡ ${state.active.config.name} [${idx}/${total}] ${step.name} ${state.active.id}`,
    ),
  );
}

export function injectSkills(
  pi: ExtensionAPI,
  step: PromptStep,
  state: WorkflowState,
): void {
  const stepSkills = step.skills ?? [];
  for (const ref of stepSkills) {
    if (isPluginSkillRef(ref)) {
      const skillPath = resolvePluginSkillPath(ref);
      const content = readFileSync(skillPath, "utf-8");
      const name = parseSkillName(content) ?? ref;
      pi.sendMessage({
        customType: "workflow:skill",
        content: `<skill name="${name}" location="${skillPath}">\n${content}\n</skill>`,
        display: true,
        details: { skillName: name, location: skillPath },
      });
      continue;
    }
    const skill = state.allSkills.find((s) => s.name === ref);
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

/**
 * Build an <available_skills> block from the effective modules for this step.
 * Queries the modules extension for module contents, then collects skill
 * name/description/location from each effective module (workflow + step level).
 */
export function buildModuleSkillsBlock(
  pi: ExtensionAPI,
  config: WorkflowConfig,
  step: PromptStep,
): string {
  // Query modules extension for module contents
  let allModules: Map<string, any> = new Map();
  pi.events.emit("module:get-state", {
    callback: (info: { shown: string[]; modules: Map<string, any> }) => {
      allModules = info.modules;
    },
  });

  // Compute effective modules (workflow-level + step-level, deduplicated)
  const effective = computeEffectiveModules(config, step);

  // Collect skills from effective modules
  const seen = new Set<string>();
  const skills: Array<{ name: string; description: string; filePath: string }> =
    [];
  for (const moduleName of effective) {
    const contents = allModules.get(moduleName);
    if (!contents?.skills) continue;
    for (const skill of contents.skills) {
      if (seen.has(skill.name)) continue;
      seen.add(skill.name);
      skills.push(skill);
    }
  }

  if (skills.length === 0) return "<available_skills>\n</available_skills>";

  const lines = ["<available_skills>"];
  for (const skill of skills) {
    lines.push("  <skill>");
    lines.push(`    <name>${escapeXml(skill.name)}</name>`);
    lines.push(
      `    <description>${escapeXml(skill.description)}</description>`,
    );
    lines.push(`    <location>${escapeXml(skill.filePath)}</location>`);
    lines.push("  </skill>");
  }
  lines.push("</available_skills>");
  return lines.join("\n") + "\n";
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface ConditionJumpContext {
  previousStepName: string;
  explanation: string;
}

export function buildMessage(
  step: WorkflowStep,
  resolvedPrompt: string,
  workflowId: string,
  workflowName: string,
  workflowPrompt: string,
  conditionJumpContext?: ConditionJumpContext,
): string {
  return messageTemplate
    .replaceAll("%WORKFLOW_ID%", workflowId)
    .replaceAll("%WORKFLOW_NAME%", workflowName)
    .replaceAll("%WORKFLOW_PROMPT%", workflowPrompt)
    .replaceAll("%CONDITION_JUMP_EXPLANATION%", formatConditionJumpExplanation(conditionJumpContext))
    .replaceAll("%STEP_NAME%", step.name)
    .replaceAll("%STEP_PROMPT%", resolvedPrompt);
}

function formatConditionJumpExplanation(context?: ConditionJumpContext): string {
  if (!context) return "";
  return `You previously executed step ${context.previousStepName}, and a condition caused to you move to this step. The reason for this move is: _${context.explanation}_. Make sure to consider this reason, as it may dictate how you approach this current step (e.g., if the previous step failed for a particular reason.)\n`;
}

async function applyStepModel(
  pi: ExtensionAPI,
  step: PromptStep,
  ctx: ExtensionContext,
  cwd: string,
): Promise<boolean> {
  // Resolve model alias to actual model reference (may include provider prefix)
  const resolvedModelRef = resolveModelAlias(step.model, cwd);
  const { provider: specifiedProvider, modelId } =
    parseModelRef(resolvedModelRef);

  let model = specifiedProvider
    ? ctx.modelRegistry.find(specifiedProvider, modelId)
    : ctx.modelRegistry.getAll().find((m) => m.id === modelId);

  if (!model) {
    ctx.ui.notify(
      `[Workflow] Model "${step.model}" (resolved to "${resolvedModelRef}") not found`,
      "error",
    );
    return false;
  }

  try {
    const selected = await pi.setModel(model);
    if (!selected) {
      ctx.ui.notify(
        `[Workflow] Failed to set model "${step.model}" (resolved to "${resolvedModelRef}"): no API key configured for ${model.provider}/${model.id}`,
        "error",
      );
      return false;
    }
  } catch (e) {
    ctx.ui.notify(
      `[Workflow] Failed to set model: ${(e as Error).message}`,
      "error",
    );
    return false;
  }

  return true;
}

function applyStepThinkingLevel(
  pi: ExtensionAPI,
  step: PromptStep,
): void {
  pi.setThinkingLevel(step.thinking ?? "off");
}

export async function handlePostStep(
  pi: ExtensionAPI,
  state: WorkflowState,
  ctx: ExtensionContext,
  step: WorkflowStep,
): Promise<void> {
  if (!step.conditions?.length) {
    if (isPromptStep(step) && step.approval) {
      ctx.ui.notify(
        `Step "${step.name}" complete. Use \`/workflow continue\` when ready.`,
        "info",
      );
      return;
    }
    await autoAdvance(pi, state, ctx);
    return;
  }

  const condResult = await evaluateConditions(pi, state, ctx);
  if (!condResult) {
    const name = state.active!.config.name;
    state.active = null;
    updateStatus(state, ctx);
    await restoreOriginalActiveTools(pi, state);
    restoreOriginalThinkingLevel(pi, state);
    await restoreOriginalModel(pi, state, ctx);
    ctx.ui.notify(
      `Workflow "${name}" aborted: condition evaluation failed`,
      "error",
    );
    return;
  }

  if (condResult === "paused") {
    // Workflow is paused waiting for manual condition evaluation
    return;
  }

  if (condResult.jump) {
    if (isMaxExecutionsReached(state, condResult.jump)) {
      state.conditionJumpContext = undefined;
      const targetStep = state.active!.config.steps.find(
        (s) => s.name === condResult.jump,
      )!;
      ctx.ui.notify(
        `[Workflow] Step "${condResult.jump}" reached maxExecutions limit (${targetStep.maxExecutions}), advancing sequentially`,
        "warning",
      );
      await autoAdvance(pi, state, ctx);
      return;
    }

    const previousStepName = step.name;
    const jumped = jumpToStep(state, condResult.jump);
    setConditionJumpContext(state, jumped, previousStepName, condResult.explanation);
    await autoJump(pi, state, ctx);
    return;
  }

  if (isPromptStep(step) && step.approval) {
    ctx.ui.notify(
      `Step "${step.name}" complete. Use \`/workflow continue\` when ready.`,
      "info",
    );
    return;
  }

  await autoAdvance(pi, state, ctx);
}

function setConditionJumpContext(
  state: WorkflowState,
  jumped: boolean,
  previousStepName: string,
  explanation?: string,
): void {
  const shouldSetContext = jumped && Boolean(explanation);
  if (!shouldSetContext) {
    state.conditionJumpContext = undefined;
    return;
  }

  state.conditionJumpContext = {
    previousStepName,
    explanation: explanation!,
  };
}

export function isMaxExecutionsReached(
  state: WorkflowState,
  targetStepName: string,
): boolean {
  if (!state.active) return false;
  const targetStep = state.active.config.steps.find(
    (s) => s.name === targetStepName,
  );
  if (!targetStep) return false;
  const count = state.active.executionCounts[targetStepName] ?? 0;
  return count >= targetStep.maxExecutions;
}

export async function runCurrentStep(
  pi: ExtensionAPI,
  state: WorkflowState,
  ctx: ExtensionContext,
): Promise<void> {
  if (!state.active) return;
  const step = currentStep(state)!;
  const conditionJumpContext = state.conditionJumpContext;

  // Track execution count
  state.active.executionCounts[step.name] =
    (state.active.executionCounts[step.name] ?? 0) + 1;

  // Emit step marker for context filtering
  pi.sendMessage({
    customType: "workflow:step-marker",
    content: `--- Step: ${step.name} (execution ${state.active.executionCounts[step.name]}) ---`,
    display: true,
    details: {
      stepName: step.name,
      execution: state.active.executionCounts[step.name],
    },
  });

  updateStatus(state, ctx);

  if (state.active.currentStepIndex === 0) {
    createDiagnostics(state.cwd, state.active.id, state.active.config.name);
  }
  if (isCommandStep(step)) {
    state.conditionJumpContext = undefined;
    const fn = getStepCommand(step.command);
    if (!fn) {
      ctx.ui.notify(
        `[Workflow] Step command "${step.command}" not found`,
        "error",
      );
      state.active = null;
      updateStatus(state, ctx);
      return;
    }

    try {
      await fn(
        { cwd: state.cwd, workflowId: state.active.id, ctx, ui: ctx.ui },
        step.args,
      );
    } catch (e) {
      ctx.ui.notify(
        `[Workflow] Step command "${step.command}" failed: ${(e as Error).message}`,
        "error",
      );
      state.active = null;
      updateStatus(state, ctx);
      return;
    }

    // Command steps don't fire agent_end, so handle post-step logic inline
    await handlePostStep(pi, state, ctx, step);
    return;
  }

  // Prompt step: existing behavior
  const promptStep = step as PromptStep;
  applyStepModules(pi, state.active.config, promptStep);

  const ok = await applyStepModel(pi, promptStep, ctx, state.cwd);
  if (!ok) {
    state.active = null;
    updateStatus(state, ctx);
    return;
  }

  applyStepThinkingLevel(pi, promptStep);
  injectSkills(pi, promptStep, state);

  let workflowPrompt: string;
  try {
    workflowPrompt = getWorkflowPrompt(state.cwd, state.active.id);
  } catch (error) {
    ctx.ui.notify(`[Workflow] ${(error as Error).message}`, "error");
    state.active = null;
    updateStatus(state, ctx);
    return;
  }

  const resolvedPrompt = resolvePrompt(promptStep.prompt, state.cwd);
  const message = buildMessage(
    step,
    resolvedPrompt,
    state.active.id,
    state.active.config.name,
    workflowPrompt,
    conditionJumpContext,
  );
  state.conditionJumpContext = undefined;
  pi.sendUserMessage(message);
}

function notifyStepTransition(
  state: WorkflowState,
  ctx: ExtensionContext,
  prevStepName: string,
): void {
  const next = currentStep(state)!;
  const modelSuffix = isPromptStep(next)
    ? `, using model ${next.model}`
    : ` (command)`;
  ctx.ui.notify(
    `✓ ${prevStepName} done. Proceeding to ${next.name}${modelSuffix}.`,
    "info",
  );
}

async function completeWorkflow(
  pi: ExtensionAPI,
  state: WorkflowState,
  ctx: ExtensionContext,
  prevStepName?: string,
): Promise<void> {
  const suffix = prevStepName ? ` (${prevStepName} done)` : "";
  ctx.ui.notify(
    `✅ Workflow "${state.active!.config.name}" complete!${suffix}`,
    "info",
  );
  completeDiagnostics(state.cwd, state.active!.id, "completed");
  state.active = null;
  updateStatus(state, ctx);
  state.advancing = false;
  await restoreOriginalActiveTools(pi, state);
  restoreOriginalThinkingLevel(pi, state);
  await restoreOriginalModel(pi, state, ctx);
}

/** Advance via command context (from /workflow approve). */
export async function advanceToNextStep(
  pi: ExtensionAPI,
  state: WorkflowState,
  ctx: ExtensionCommandContext,
): Promise<void> {
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
): Promise<{ jump: string; explanation?: string } | "paused" | null> {
  const step = currentStep(state);
  if (!step?.conditions?.length) return null;

  const workflowId = state.active!.id;
  const total = step.conditions.length;
  const startIndex = state.pendingConditionIndex ?? 0;

  for (let i = startIndex; i < total; i++) {
    const cond = step.conditions[i];

    // Clear previous result
    deleteEntry(state.cwd, workflowId, "workflow-condition-result");

    let condUsage: TokenUsage | null = null;
    if (isCommandCondition(cond)) {
      ctx.ui.notify(
        `Evaluating condition ${i + 1}/${total}: command "${cond.command}"`,
        "info",
      );
      condUsage = await evaluateCommandCondition(cond, state.cwd, workflowId, ctx);
    } else {
      ctx.ui.notify(
        `Evaluating condition ${i + 1}/${total}: "${cond.prompt.slice(0, 60)}..."`,
        "info",
      );
      condUsage = await evaluateCondition(cond, state.cwd, workflowId, ctx);
    }

    // Record condition evaluation tokens against the current step
    if (condUsage) {
      const condStep = currentStep(state);
      if (condStep) {
        const execution = state.active!.executionCounts[condStep.name] ?? 0;
        const condModel = isPromptCondition(cond) ? cond.model : "command";
        recordStepUsage(state.cwd, workflowId, condStep.name, execution, condModel, condUsage);
      }
    }

    // Read result from memory
    const raw = readKey(state.cwd, workflowId, "workflow-condition-result");
    if (!raw) {
      // Model didn't call the tool / command didn't write — pause for manual evaluation
      state.pendingConditionIndex = i;
      const condLabel = isCommandCondition(cond)
        ? `command: ${cond.command}`
        : `"${cond.prompt.slice(0, 80)}${cond.prompt.length > 80 ? "..." : ""}"`;
      ctx.ui.notify(
        `⚠️ Condition ${i + 1}/${total} (${condLabel}) did not produce a result. Use \`/evaluate-condition true/false <explanation>\` to evaluate manually, then \`/workflow continue\` to resume.`,
        "warning",
      );
      return "paused";
    }

    let parsed: { result: string; explanation: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      state.pendingConditionIndex = i;
      ctx.ui.notify(
        `⚠️ Condition ${i + 1}/${total} produced invalid result. Use \`/evaluate-condition true/false <explanation>\` to evaluate manually.`,
        "warning",
      );
      return "paused";
    }

    const condLabel = isCommandCondition(cond)
      ? `command: ${cond.command}`
      : `${cond.prompt.slice(0, 80)}${cond.prompt.length > 80 ? "..." : ""}`;

    ctx.ui.notify(
      `Condition ${i + 1}: ${parsed.result} — ${parsed.explanation}`,
      "info",
    );

    pi.sendMessage({
      customType: "workflow:condition-result",
      content: `**Condition ${i + 1}/${total}** — \`${condLabel}\`\n\n**Result:** ${parsed.result}\n**Explanation:** ${parsed.explanation}`,
      display: true,
      details: {
        conditionIndex: i,
        result: parsed.result,
        explanation: parsed.explanation,
      },
    });

    if (parsed.result === "true") {
      state.pendingConditionIndex = null;
      return { jump: cond.jump, explanation: cond.explanation };
    }
  }

  // No conditions matched — sequential advance
  state.pendingConditionIndex = null;
  return { jump: "" };
}

/** Jump to a named step from agent_end (index already set by jumpToStep). */
export async function autoJump(
  pi: ExtensionAPI,
  state: WorkflowState,
  ctx: ExtensionContext,
): Promise<void> {
  if (!state.active || !state.savedCommandCtx) return;
  state.advancing = true;

  const step = currentStep(state)!;
  ctx.ui.notify(`Jumping to step "${step.name}"`, "info");
  updateStatus(state, ctx);

  const cmdCtx = state.savedCommandCtx;
  setTimeout(async () => {
    try {
      await cmdCtx.waitForIdle();
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
export function filterToCurrentStep(
  event: ContextEvent,
  state: WorkflowState,
): { messages: typeof event.messages } | undefined {
  if (!state.active) {
    // No active workflow — just filter condition results as before
    const filtered = event.messages.filter(
      (m: any) =>
        !(m.role === "custom" && m.customType === "workflow:condition-result"),
    );
    if (filtered.length !== event.messages.length) {
      return { messages: filtered };
    }
    return undefined;
  }

  const step = currentStep(state);
  if (!step) return undefined;

  const execCount = state.active.executionCounts[step.name] ?? 0;

  // Find the last step marker matching current step + execution
  let markerIndex = -1;
  for (let i = event.messages.length - 1; i >= 0; i--) {
    const m = event.messages[i] as any;
    const isCurrentStepMarker =
      m.role === "custom" &&
      m.customType === "workflow:step-marker" &&
      m.details?.stepName === step.name &&
      m.details?.execution === execCount;
    if (isCurrentStepMarker) {
      markerIndex = i;
      break;
    }
  }

  if (markerIndex === -1) return undefined;

  // Keep only messages after the marker, excluding condition results
  const filtered = event.messages
    .slice(markerIndex + 1)
    .filter(
      (m: any) =>
        !(m.role === "custom" && m.customType === "workflow:condition-result"),
    );

  return { messages: filtered };
}

export async function autoAdvance(
  pi: ExtensionAPI,
  state: WorkflowState,
  ctx: ExtensionContext,
): Promise<void> {
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
      state.advancing = false;
      await runCurrentStep(pi, state, cmdCtx);
    } catch (e) {
      ctx.ui.notify(
        `Workflow advance failed: ${(e as Error).message}`,
        "error",
      );
      state.active = null;
      state.advancing = false;
      updateStatus(state, ctx);
    }
  }, 0);
}
