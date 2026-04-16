import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { WORKFLOWS_DIR } from "../shared/paths.js";
import { parse as parseYaml } from "yaml";
import type { ExtensionContext, ModelRegistry } from "@mariozechner/pi-coding-agent";
import type { Skill } from "@mariozechner/pi-coding-agent";
import type { WorkflowConfig, WorkflowStep, PromptStep, CommandStep, PromptCondition, CommandCondition, WorkflowThinkingLevel } from "./types.js";
import { isPromptStep, isCommandStep, isPromptCondition, isCommandCondition } from "./types.js";
import { resolveModelAlias, parseModelRef } from "./models.js";
import { listYamlBasenames } from "../shared/yaml-files.js";
import { getConditionCommand, getStepCommand } from "./commands/registry.js";
import { getEnabledPlugins } from "../shared/plugins.js";
import { getPluginsDir } from "../shared/home.js";
import { isPluginSkillRef, resolvePluginSkillPath } from "./plugin-skills.js";
import { resolvePromptRef } from "./prompt-resolve.js";

type RawRecord = Record<string, unknown>;

// --- Public API ---

export function getWorkflowsDir(cwd: string): string {
	return join(cwd, WORKFLOWS_DIR);
}

export function listWorkflows(cwd: string): string[] {
	const local = listYamlBasenames(getWorkflowsDir(cwd));

	const plugin: string[] = [];
	for (const name of getEnabledPlugins(cwd)) {
		const dir = join(getPluginsDir(), name, "workflows");
		if (existsSync(dir)) {
			for (const base of listYamlBasenames(dir)) {
				plugin.push(`${name}:${base}`);
			}
		}
	}

	return [...local, ...plugin];
}

export function loadWorkflowFile(name: string, cwd: string): WorkflowConfig {
	const colonIdx = name.indexOf(":");
	if (colonIdx !== -1) {
		const pluginName = name.slice(0, colonIdx);
		const workflowName = name.slice(colonIdx + 1);
		return loadFromDir(workflowName, join(getPluginsDir(), pluginName, "workflows"), cwd);
	}
	return loadFromDir(name, getWorkflowsDir(cwd), cwd);
}

export function resolvePrompt(prompt: string, cwd: string): string {
	if (prompt.startsWith("@")) {
		const ref = prompt.slice(1);
		const filePath = resolvePromptRef(ref, cwd);
		return readFileSync(filePath, "utf-8");
	}
	return prompt;
}

export function validate(config: WorkflowConfig, cwd: string, allSkills: Skill[], ctx: ExtensionContext, knownModules?: Set<string>): string | null {
	const modulesError = validateModules(config.modules, knownModules);
	if (modulesError) return modulesError;

	const registry = ctx.modelRegistry;

	for (const step of config.steps) {
		const stepError = validateStep(step, config, cwd, allSkills, registry, knownModules);
		if (stepError) return stepError;
	}
	return null;
}

// --- Workflow file loading ---

function loadFromDir(name: string, dir: string, cwd: string): WorkflowConfig {
	const filePath = resolveYamlPath(dir, name);
	const content = readFileSync(filePath, "utf-8");
	const parsed = parseYaml(content) as RawRecord;

	if (!parsed.name || typeof parsed.name !== "string") {
		throw new Error("Workflow must have a 'name' field");
	}
	if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
		throw new Error("Workflow must have at least one step");
	}

	const steps = (parsed.steps as RawRecord[]).map((s, idx) => parseStep(s, idx + 1, cwd));
	const modules = parseModules(parsed.modules);

	return { name: parsed.name as string, modules, steps };
}

function resolveYamlPath(dir: string, name: string): string {
	for (const ext of [".yml", ".yaml"]) {
		const candidate = join(dir, `${name}${ext}`);
		if (existsSync(candidate)) return candidate;
	}
	throw new Error(`Workflow file not found: ${name}.yml`);
}

// --- Step parsing ---

function parseStep(raw: RawRecord, stepNum: number, cwd: string): WorkflowStep {
	if (!raw.name) throw new Error(`Step ${stepNum} missing 'name'`);
	const stepName = raw.name as string;

	const hasCommand = "command" in raw && raw.command != null;
	const hasPrompt = "prompt" in raw && raw.prompt != null;

	if (hasCommand && hasPrompt) {
		throw new Error(`Step ${stepNum} "${stepName}": 'command' and 'prompt' are mutually exclusive`);
	}
	if (!hasCommand && !hasPrompt) {
		throw new Error(`Step ${stepNum} "${stepName}": must have either 'command' or 'prompt'`);
	}

	const maxExecutions = parseMaxExecutions(raw.maxExecutions, stepNum, stepName);
	const conditions = raw.conditions
		? (raw.conditions as RawRecord[]).map((c, ci) => parseCondition(c, stepNum, ci + 1, cwd))
		: undefined;

	if (hasCommand) return parseCommandStep(raw, stepNum, stepName, maxExecutions, conditions);
	return parsePromptStep(raw, stepNum, stepName, maxExecutions, conditions, cwd);
}

function parseMaxExecutions(rawMax: unknown, stepNum: number, stepName: string): number {
	if (rawMax == null) return 10;
	if (typeof rawMax !== "number" || !Number.isInteger(rawMax) || rawMax <= 0) {
		throw new Error(`Step ${stepNum} "${stepName}": 'maxExecutions' must be a positive integer, got: ${rawMax}`);
	}
	return rawMax;
}

function parseCommandStep(
	raw: RawRecord, stepNum: number, stepName: string,
	maxExecutions: number, conditions: (PromptCondition | CommandCondition)[] | undefined,
): CommandStep {
	const promptOnlyFields = ["model", "thinking", "prompt", "skills", "modules", "approval"];
	for (const field of promptOnlyFields) {
		if (raw[field] != null) {
			throw new Error(`Step ${stepNum} "${stepName}": '${field}' is not allowed with 'command'`);
		}
	}
	return {
		name: stepName,
		command: raw.command as string,
		args: (raw.args as Record<string, string>) ?? undefined,
		maxExecutions,
		conditions,
	};
}

function parsePromptStep(
	raw: RawRecord, stepNum: number, stepName: string,
	maxExecutions: number, conditions: (PromptCondition | CommandCondition)[] | undefined,
	cwd: string,
): PromptStep {
	if (!raw.model) throw new Error(`Step ${stepNum} missing 'model'`);
	return {
		name: stepName,
		model: resolveModelAlias(raw.model as string, cwd),
		thinking: parseThinkingLevel(raw.thinking, `Step ${stepNum} "${stepName}"`),
		prompt: raw.prompt as string,
		skills: (raw.skills as string[]) ?? [],
		modules: parseModules(raw.modules, stepNum),
		approval: raw.approval === true,
		maxExecutions,
		conditions,
	};
}

// --- Condition parsing ---

function parseCondition(raw: RawRecord, stepNum: number, condNum: number, cwd: string): PromptCondition | CommandCondition {
	const hasCommand = "command" in raw && raw.command != null;
	const hasPrompt = "prompt" in raw && raw.prompt != null;

	if (hasCommand && hasPrompt) {
		throw new Error(`Step ${stepNum}, condition ${condNum}: 'command' and 'prompt' are mutually exclusive`);
	}
	if (!hasCommand && !hasPrompt) {
		throw new Error(`Step ${stepNum}, condition ${condNum}: must have either 'command' or 'prompt'`);
	}
	if (!raw.jump) throw new Error(`Step ${stepNum}, condition ${condNum} missing 'jump'`);

	if (hasCommand) {
		if (raw.model) throw new Error(`Step ${stepNum}, condition ${condNum}: 'model' is not allowed with 'command'`);
		if (raw.thinking != null) throw new Error(`Step ${stepNum}, condition ${condNum}: 'thinking' is not allowed with 'command'`);
		return {
			command: raw.command as string,
			args: (raw.args as Record<string, string>) ?? undefined,
			jump: raw.jump as string,
		} satisfies CommandCondition;
	}

	if (!raw.model) throw new Error(`Step ${stepNum}, condition ${condNum} missing 'model'`);
	return {
		prompt: raw.prompt as string,
		model: resolveModelAlias(raw.model as string, cwd),
		thinking: parseThinkingLevel(raw.thinking, `Step ${stepNum}, condition ${condNum}`),
		jump: raw.jump as string,
	} satisfies PromptCondition;
}

// --- Shared parsing helpers ---

function parseThinkingLevel(value: unknown, location: string): WorkflowThinkingLevel | undefined {
	if (value == null) return undefined;
	if (
		value === "off" ||
		value === "minimal" ||
		value === "low" ||
		value === "medium" ||
		value === "high" ||
		value === "xhigh"
	) {
		return value;
	}
	throw new Error(`${location}: 'thinking' must be one of off, minimal, low, medium, high, xhigh`);
}

// --- Shared parsing helpers ---

function parseModules(value: unknown, stepNum?: number): string[] | undefined {
	if (value == null) return undefined;
	if (Array.isArray(value)) return value as string[];
	if (typeof value === "string") return [value];
	const location = stepNum != null ? `Step ${stepNum} 'modules'` : "Workflow 'modules'";
	throw new Error(`${location} must be a string or string array, got: ${typeof value}`);
}

// --- Validation ---

function validateModules(modules: string[] | undefined, knownModules?: Set<string>): string | null {
	if (!knownModules || !modules) return null;
	for (const mod of modules) {
		if (!knownModules.has(mod)) {
			return `Workflow-level module "${mod}" not found. Available modules: ${[...knownModules].join(", ") || "(none)"}`;
		}
	}
	return null;
}

function isModelInRegistry(modelRef: string, cwd: string, registry: ModelRegistry): boolean {
	const resolved = resolveModelAlias(modelRef, cwd);
	const { provider, modelId } = parseModelRef(resolved);
	if (provider) return !!registry.find(provider, modelId);
	return registry.getAll().some((m) => m.id === modelId);
}

function validateStep(
	step: WorkflowStep, config: WorkflowConfig, cwd: string, allSkills: Skill[],
	registry: ModelRegistry, knownModules?: Set<string>,
): string | null {
	if (isPromptStep(step)) {
		const error = validatePromptStep(step, cwd, allSkills, registry, knownModules);
		if (error) return error;
	} else if (isCommandStep(step)) {
		if (!getStepCommand(step.command) && !getConditionCommand(step.command)) {
			return `Step "${step.name}": command "${step.command}" not found in registry`;
		}
	}

	return validateConditions(step, config, cwd, registry);
}

function validatePromptStep(
	step: PromptStep, cwd: string, allSkills: Skill[],
	registry: ModelRegistry, knownModules?: Set<string>,
): string | null {
	if (!isModelInRegistry(step.model, cwd, registry)) {
		const resolved = resolveModelAlias(step.model, cwd);
		return `Model "${step.model}" (resolved to "${resolved}") not found in registry`;
	}

	if (step.prompt.startsWith("@")) {
		const ref = step.prompt.slice(1);
		try {
			resolvePromptRef(ref, cwd);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return `Prompt file resolution failed: ${ref} (${message})`;
		}
	}

	const skillError = validateSkills(step.skills, allSkills);
	if (skillError) return skillError;

	if (knownModules && step.modules) {
		for (const mod of step.modules) {
			if (!knownModules.has(mod)) {
				return `Step "${step.name}": module "${mod}" not found. Available modules: ${[...knownModules].join(", ") || "(none)"}`;
			}
		}
	}

	return null;
}

function validateSkills(skills: string[] | undefined, allSkills: Skill[]): string | null {
	for (const skillName of skills ?? []) {
		if (isPluginSkillRef(skillName)) {
			const error = validatePluginSkill(skillName);
			if (error) return error;
		} else {
			if (!allSkills.some((s) => s.name === skillName)) return `Skill "${skillName}" not found`;
		}
	}
	return null;
}

function validatePluginSkill(skillName: string): string | null {
	const repo = skillName.split("/")[0];
	const repoDir = join(getPluginsDir(), repo);
	if (!existsSync(repoDir) || !statSync(repoDir).isDirectory()) {
		return `Plugin repo "${repo}" not found in ~/.pi/plugins/`;
	}

	const skillPath = resolvePluginSkillPath(skillName);
	if (!existsSync(dirname(skillPath))) return `Plugin skill path not found: ${skillName}`;
	if (!existsSync(skillPath)) return `Plugin skill has no SKILL.md: ${skillName}`;
	return null;
}

function validateConditions(
	step: WorkflowStep, config: WorkflowConfig, cwd: string,
	registry: ModelRegistry,
): string | null {
	if (!step.conditions) return null;

	for (const cond of step.conditions) {
		if (!config.steps.find((s) => s.name === cond.jump)) {
			return `Step "${step.name}", condition jump target "${cond.jump}" not found`;
		}

		if (isPromptCondition(cond)) {
			if (!isModelInRegistry(cond.model, cwd, registry)) {
				const resolved = resolveModelAlias(cond.model, cwd);
				return `Step "${step.name}", condition model "${cond.model}" (resolved to "${resolved}") not found in registry`;
			}
			if (cond.prompt.startsWith("@")) {
				const ref = cond.prompt.slice(1);
				try {
					resolvePromptRef(ref, cwd);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					return `Condition prompt file resolution failed: ${ref} (${message})`;
				}
			}
		} else if (isCommandCondition(cond)) {
			if (!getConditionCommand(cond.command)) {
				return `Step "${step.name}", condition command "${cond.command}" not found in registry`;
			}
		}
	}

	return null;
}
