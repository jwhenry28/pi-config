import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { Skill } from "@mariozechner/pi-coding-agent";
import type { WorkflowConfig, WorkflowStep } from "./types.js";

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
		const conditions = s.conditions
			? (s.conditions as Record<string, unknown>[]).map((c, ci) => {
				if (!c.prompt) throw new Error(`Step ${idx + 1}, condition ${ci + 1} missing 'prompt'`);
				if (!c.model) throw new Error(`Step ${idx + 1}, condition ${ci + 1} missing 'model'`);
				if (!c.jump) throw new Error(`Step ${idx + 1}, condition ${ci + 1} missing 'jump'`);
				return {
					prompt: c.prompt as string,
					model: c.model as string,
					jump: c.jump as string,
				};
			})
			: undefined;

		return {
			name: s.name as string,
			model: s.model as string,
			prompt: s.prompt as string,
			skills: (s.skills as string[]) ?? [],
			approval: s.approval === true,
			conditions,
		};
	});

	return { name: parsed.name as string, steps };
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

export function validate(config: WorkflowConfig, cwd: string, allSkills: Skill[], ctx: ExtensionContext): string | null {
	const allModels = ctx.modelRegistry.getAll();
	for (const step of config.steps) {
		if (!allModels.find((m) => m.id === step.model)) {
			return `Model "${step.model}" not found in registry`;
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

		if (step.conditions) {
			for (const cond of step.conditions) {
				if (!allModels.find((m) => m.id === cond.model)) {
					return `Step "${step.name}", condition model "${cond.model}" not found in registry`;
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
