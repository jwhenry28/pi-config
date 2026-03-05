import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "@sinclair/typebox";
import {
	createAgentSession,
	SessionManager,
	SettingsManager,
	DefaultResourceLoader,
	createCodingTools,
	type ExtensionContext,
	type ToolDefinition,
} from "@mariozechner/pi-coding-agent";
import type { PromptCondition, CommandCondition } from "./types.js";
import { resolvePrompt } from "./loader.js";
import { resolveModelAlias, parseModelRef } from "./models.js";
import { getConditionCommand } from "./commands/registry.js";
import type { CommandContext } from "./commands/registry.js";
import { writeKey } from "../memory/store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const conditionTemplate = readFileSync(join(__dirname, "condition-prompt.md"), "utf-8");

/**
 * Create the evaluate_condition tool definition that writes to workflow memory.
 */
function createEvaluateConditionTool(cwd: string, workflowId: string): ToolDefinition {
	return {
		name: "evaluate_condition",
		label: "Evaluate Condition",
		description: "Report the result of a condition evaluation. Call this exactly once with your assessment.",
		parameters: Type.Object({
			result: Type.Union([Type.Literal("true"), Type.Literal("false")], {
				description: 'Whether the condition is met: "true" or "false"',
			}),
			explanation: Type.String({
				description: "Brief explanation of why the condition is or is not met",
			}),
		}),
		async execute(_toolCallId, params) {
			const { result, explanation } = params;
			if (result !== "true" && result !== "false") {
				return {
					content: [{ type: "text", text: 'Error: result must be exactly "true" or "false". Please try again.' }],
					isError: true,
					details: {},
				};
			}
			writeKey(cwd, workflowId, "workflow-condition-result",
				JSON.stringify({ result, explanation }));
			return {
				content: [{ type: "text", text: `Condition evaluated: ${result} — ${explanation}` }],
				details: {},
			};
		},
	};
}

export async function evaluateCondition(
	condition: PromptCondition,
	cwd: string,
	workflowId: string,
	ctx: ExtensionContext,
): Promise<void> {
	const resolvedPrompt = resolvePrompt(condition.prompt, cwd);
	const systemPrompt = conditionTemplate.replace("%CONDITION_PROMPT%", resolvedPrompt);

	const resolvedModelRef = resolveModelAlias(condition.model, cwd);
	const { provider: specifiedProvider, modelId } = parseModelRef(resolvedModelRef);

	let model: any = null;

	if (specifiedProvider) {
		const registryAny = ctx.modelRegistry as any;
		if (registryAny.find) {
			model = registryAny.find(specifiedProvider, modelId);
		}
	} else {
		model = ctx.modelRegistry.getAll().find((m) => m.id === modelId);
	}

	if (!model) {
		ctx.ui.notify(`Condition model "${condition.model}" (resolved to "${resolvedModelRef}") not found in registry`, "error");
		return;
	}

	const evaluateTool = createEvaluateConditionTool(cwd, workflowId);

	const loader = new DefaultResourceLoader({
		cwd,
		systemPromptOverride: () => systemPrompt,
		skillsOverride: () => ({ skills: [], diagnostics: [] }),
	});
	await loader.reload();

	const { session } = await createAgentSession({
		cwd,
		model,
		thinkingLevel: "off",
		tools: createCodingTools(cwd),
		customTools: [evaluateTool],
		resourceLoader: loader,
		sessionManager: SessionManager.inMemory(),
		settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
		modelRegistry: ctx.modelRegistry,
	});

	try {
		await session.prompt(resolvedPrompt);
	} finally {
		session.dispose();
	}
}

export async function evaluateCommandCondition(
	condition: CommandCondition,
	cwd: string,
	workflowId: string,
	ctx: ExtensionContext,
): Promise<void> {
	const fn = getConditionCommand(condition.command);
	if (!fn) {
		ctx.ui.notify(`Command "${condition.command}" not found in registry`, "error");
		return;
	}

	try {
		const commandCtx: CommandContext = { cwd, workflowId };
		await fn(commandCtx, condition.args);
	} catch (e) {
		ctx.ui.notify(`Command "${condition.command}" failed: ${(e as Error).message}`, "warning");
	}
}
