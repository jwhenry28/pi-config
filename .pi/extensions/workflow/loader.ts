import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { Skill } from "@mariozechner/pi-coding-agent";
import type { WorkflowConfig, WorkflowStep } from "./types.js";
import { resolveModelAlias, parseModelRef } from "./models.js";

export function getWorkflowsDir(cwd: string): string {
	return join(cwd, ".pi", "workflows");
}

export function listWorkflows(cwd: string): string[] {
	const dir = getWorkflowsDir(cwd);
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
		.map((f) => f.replace(/\.ya?ml$/, ""));
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
		if (!s.model) throw new Error(`Step ${idx + 1} missing 'model'`);
		if (!s.prompt) throw new Error(`Step ${idx + 1} missing 'prompt'`);
		
		// Resolve model alias to actual model ID
		const resolvedModel = resolveModelAlias(s.model as string, cwd);
		
		const conditions = s.conditions
			? (s.conditions as Record<string, unknown>[]).map((c, ci) => {
				if (!c.prompt) throw new Error(`Step ${idx + 1}, condition ${ci + 1} missing 'prompt'`);
				if (!c.model) throw new Error(`Step ${idx + 1}, condition ${ci + 1} missing 'model'`);
				if (!c.jump) throw new Error(`Step ${idx + 1}, condition ${ci + 1} missing 'jump'`);
				return {
					prompt: c.prompt as string,
					model: resolveModelAlias(c.model as string, cwd),
					jump: c.jump as string,
				};
			})
			: undefined;

		return {
			name: s.name as string,
			model: resolvedModel,
			prompt: s.prompt as string,
			skills: (s.skills as string[]) ?? [],
			modules: parseModules(s.modules, idx + 1),
			approval: s.approval === true,
			conditions,
		};
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
		// Resolve model alias before validation
		const resolvedModelRef = resolveModelAlias(step.model, cwd);
		const { provider: specifiedProvider, modelId } = parseModelRef(resolvedModelRef);
		
		let inRegistry: boolean;
		if (specifiedProvider && registryAny.find) {
			// Provider explicitly specified, use registry.find()
			inRegistry = !!registryAny.find(specifiedProvider, modelId);
		} else {
			// No provider specified, look up by model ID only
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

		if (step.conditions) {
			for (const cond of step.conditions) {
				// Resolve model alias before validation
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
				if (!config.steps.find((s) => s.name === cond.jump)) {
					return `Step "${step.name}", condition jump target "${cond.jump}" not found`;
				}
				if (cond.prompt.startsWith("@")) {
					const filePath = resolve(cwd, cond.prompt.slice(1));
					if (!existsSync(filePath)) {
						return `Condition prompt file not found: ${cond.prompt.slice(1)}`;
					}
				}
			}
		}
	}
	return null;
}
