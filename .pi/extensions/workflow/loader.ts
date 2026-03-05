import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { Skill } from "@mariozechner/pi-coding-agent";
import type { WorkflowConfig, WorkflowStep, PromptStep, CommandStep, PromptCondition, CommandCondition } from "./types.js";
import { isPromptStep, isCommandStep, isPromptCondition, isCommandCondition } from "./types.js";
import { resolveModelAlias, parseModelRef } from "./models.js";
import { listYamlBasenames } from "../shared/yaml-files.js";
import { getConditionCommand, getStepCommand } from "./commands/registry.js";

export function getWorkflowsDir(cwd: string): string {
	return join(cwd, ".pi", "workflows");
}

export function listWorkflows(cwd: string): string[] {
	const workflowsDirectory = getWorkflowsDir(cwd);
	return listYamlBasenames(workflowsDirectory);
}

function parseModules(value: unknown, stepNum?: number): string[] | undefined {
	if (value == null) return undefined;
	if (Array.isArray(value)) return value as string[];
	if (typeof value === "string") return [value];
	const location = stepNum != null ? `Step ${stepNum} 'modules'` : "Workflow 'modules'";
	throw new Error(`${location} must be a string or string array, got: ${typeof value}`);
}

export function loadWorkflowFile(name: string, cwd: string): WorkflowConfig {
	const dir = getWorkflowsDir(cwd);
	let filePath = join(dir, `${name}.yml`);
	if (!existsSync(filePath)) {
		filePath = join(dir, `${name}.yaml`);
	}
	if (!existsSync(filePath)) {
		throw new Error(`Workflow file not found: ${name}.yml`);
	}
	const content = readFileSync(filePath, "utf-8");
	const parsed = parseYaml(content) as Record<string, unknown>;

	if (!parsed.name || typeof parsed.name !== "string") {
		throw new Error("Workflow must have a 'name' field");
	}
	if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
		throw new Error("Workflow must have at least one step");
	}

	const steps: WorkflowStep[] = (parsed.steps as Record<string, unknown>[]).map((s, idx) => {
		if (!s.name) throw new Error(`Step ${idx + 1} missing 'name'`);

		const hasCommand = "command" in s && s.command != null;
		const hasPrompt = "prompt" in s && s.prompt != null;

		if (hasCommand && hasPrompt) {
			throw new Error(`Step ${idx + 1} "${s.name}": 'command' and 'prompt' are mutually exclusive`);
		}
		if (!hasCommand && !hasPrompt) {
			throw new Error(`Step ${idx + 1} "${s.name}": must have either 'command' or 'prompt'`);
		}

		// Parse maxExecutions (shared by both step types)
		const rawMax = s.maxExecutions;
		let maxExecutions = 10; // default
		if (rawMax != null) {
			if (typeof rawMax !== "number" || !Number.isInteger(rawMax) || rawMax <= 0) {
				throw new Error(`Step ${idx + 1} "${s.name}": 'maxExecutions' must be a positive integer, got: ${rawMax}`);
			}
			maxExecutions = rawMax;
		}

		// Parse conditions (shared by both step types)
		const conditions = s.conditions
			? (s.conditions as Record<string, unknown>[]).map((c, ci) => {
				const condHasCommand = "command" in c && c.command != null;
				const condHasPrompt = "prompt" in c && c.prompt != null;

				if (condHasCommand && condHasPrompt) {
					throw new Error(`Step ${idx + 1}, condition ${ci + 1}: 'command' and 'prompt' are mutually exclusive`);
				}
				if (!condHasCommand && !condHasPrompt) {
					throw new Error(`Step ${idx + 1}, condition ${ci + 1}: must have either 'command' or 'prompt'`);
				}
				if (!c.jump) throw new Error(`Step ${idx + 1}, condition ${ci + 1} missing 'jump'`);

				if (condHasCommand) {
					if (c.model) throw new Error(`Step ${idx + 1}, condition ${ci + 1}: 'model' is not allowed with 'command'`);
					return {
						command: c.command as string,
						args: (c.args as Record<string, string>) ?? undefined,
						jump: c.jump as string,
					} satisfies CommandCondition;
				}

				if (!c.model) throw new Error(`Step ${idx + 1}, condition ${ci + 1} missing 'model'`);
				return {
					prompt: c.prompt as string,
					model: resolveModelAlias(c.model as string, cwd),
					jump: c.jump as string,
				} satisfies PromptCondition;
			})
			: undefined;

		if (hasCommand) {
			// Validate no prompt-only fields
			for (const forbidden of ["model", "prompt", "skills", "modules", "approval"]) {
				if ((s as Record<string, unknown>)[forbidden] != null) {
					throw new Error(`Step ${idx + 1} "${s.name}": '${forbidden}' is not allowed with 'command'`);
				}
			}
			return {
				name: s.name as string,
				command: s.command as string,
				args: (s.args as Record<string, string>) ?? undefined,
				maxExecutions,
				conditions,
			} satisfies CommandStep;
		}

		// Prompt step
		if (!s.model) throw new Error(`Step ${idx + 1} missing 'model'`);
		const resolvedModel = resolveModelAlias(s.model as string, cwd);
		return {
			name: s.name as string,
			model: resolvedModel,
			prompt: s.prompt as string,
			skills: (s.skills as string[]) ?? [],
			modules: parseModules(s.modules, idx + 1),
			approval: s.approval === true,
			maxExecutions,
			conditions,
		} satisfies PromptStep;
	});

	const modules = parseModules(parsed.modules);

	return { name: parsed.name as string, modules, steps };
}

export function resolvePrompt(prompt: string, cwd: string): string {
	if (prompt.startsWith("@")) {
		const filePath = resolve(cwd, prompt.slice(1));
		if (!existsSync(filePath)) {
			throw new Error(`Prompt file not found: ${prompt.slice(1)}`);
		}
		return readFileSync(filePath, "utf-8");
	}
	return prompt;
}

export function validate(config: WorkflowConfig, cwd: string, allSkills: Skill[], ctx: ExtensionContext, knownModules?: Set<string>): string | null {
	if (knownModules && config.modules) {
		for (const mod of config.modules) {
			if (!knownModules.has(mod)) {
				return `Workflow-level module "${mod}" not found. Available modules: ${[...knownModules].join(", ") || "(none)"}`;
			}
		}
	}

	const allModels = ctx.modelRegistry.getAll();
	const registryAny = ctx.modelRegistry as any;

	for (const step of config.steps) {
		if (isPromptStep(step)) {
			const resolvedModelRef = resolveModelAlias(step.model, cwd);
			const { provider: specifiedProvider, modelId } = parseModelRef(resolvedModelRef);

			let inRegistry: boolean;
			if (specifiedProvider && registryAny.find) {
				inRegistry = !!registryAny.find(specifiedProvider, modelId);
			} else {
				inRegistry = allModels.some((m) => m.id === modelId);
			}
			if (!inRegistry) {
				return `Model "${step.model}" (resolved to "${resolvedModelRef}") not found in registry`;
			}

			if (step.prompt.startsWith("@")) {
				const filePath = resolve(cwd, step.prompt.slice(1));
				if (!existsSync(filePath)) {
					return `Prompt file not found: ${step.prompt.slice(1)}`;
				}
			}

			if (step.skills) {
				for (const skillName of step.skills) {
					if (!allSkills.some((s) => s.name === skillName)) {
						return `Skill "${skillName}" not found`;
					}
				}
			}

			if (knownModules && step.modules) {
				for (const mod of step.modules) {
					if (!knownModules.has(mod)) {
						return `Step "${step.name}": module "${mod}" not found. Available modules: ${[...knownModules].join(", ") || "(none)"}`;
					}
				}
			}
		} else if (isCommandStep(step)) {
			if (!getStepCommand(step.command) && !getConditionCommand(step.command)) {
				return `Step "${step.name}": command "${step.command}" not found in registry`;
			}
		}

		// Condition validation (both step types can have conditions)
		if (step.conditions) {
			for (const cond of step.conditions) {
				if (!config.steps.find((s) => s.name === cond.jump)) {
					return `Step "${step.name}", condition jump target "${cond.jump}" not found`;
				}

				if (isPromptCondition(cond)) {
					const resolvedCondRef = resolveModelAlias(cond.model, cwd);
					const { provider: condProvider, modelId: condModelId } = parseModelRef(resolvedCondRef);

					let condInRegistry: boolean;
					if (condProvider && registryAny.find) {
						condInRegistry = !!registryAny.find(condProvider, condModelId);
					} else {
						condInRegistry = allModels.some((m) => m.id === condModelId);
					}
					if (!condInRegistry) {
						return `Step "${step.name}", condition model "${cond.model}" (resolved to "${resolvedCondRef}") not found in registry`;
					}
					if (cond.prompt.startsWith("@")) {
						const filePath = resolve(cwd, cond.prompt.slice(1));
						if (!existsSync(filePath)) {
							return `Condition prompt file not found: ${cond.prompt.slice(1)}`;
						}
					}
				} else if (isCommandCondition(cond)) {
					if (!getConditionCommand(cond.command)) {
						return `Step "${step.name}", condition command "${cond.command}" not found in registry`;
					}
				}
			}
		}
	}
	return null;
}
