import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
	createAgentSession,
	SessionManager,
	SettingsManager,
	DefaultResourceLoader,
	createCodingTools,
	AuthStorage,
	type ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type { StepCondition } from "./types.js";
import { resolvePrompt } from "./loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const conditionTemplate = readFileSync(join(__dirname, "condition-prompt.md"), "utf-8");

const MAX_RETRIES = 5;

export interface ConditionResult {
	result: "yes" | "no";
	explanation: string;
}

function parseConditionResult(text: string): ConditionResult | null {
	const match = text.match(/\{[^{}]*"result"\s*:\s*"(yes|no)"[^{}]*\}/);
	if (!match) return null;
	try {
		const parsed = JSON.parse(match[0]);
		if ((parsed.result === "yes" || parsed.result === "no") && typeof parsed.explanation === "string") {
			return { result: parsed.result, explanation: parsed.explanation };
		}
	} catch {}
	return null;
}

function getLastAssistantText(messages: Array<{ role: string; content: unknown }>): string | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "assistant") {
			if (Array.isArray(msg.content)) {
				const textParts = (msg.content as Array<{ type: string; text?: string }>)
					.filter((p) => p.type === "text" && p.text)
					.map((p) => p.text!);
				if (textParts.length > 0) return textParts.join("\n");
			}
		}
	}
	return null;
}

export async function evaluateCondition(
	condition: StepCondition,
	cwd: string,
	ctx: ExtensionContext,
): Promise<ConditionResult | null> {
	const resolvedPrompt = resolvePrompt(condition.prompt, cwd);
	const systemPrompt = conditionTemplate.replace("%CONDITION_PROMPT%", resolvedPrompt);

	const model = ctx.modelRegistry.getAll().find((m) => m.id === condition.model);
	if (!model) {
		ctx.ui.notify(`Condition model "${condition.model}" not found`, "error");
		return null;
	}

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
		resourceLoader: loader,
		sessionManager: SessionManager.inMemory(),
		settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
		modelRegistry: ctx.modelRegistry,
	});

	try {
		await session.prompt(resolvedPrompt);

		for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
			const lastText = getLastAssistantText(session.messages as Array<{ role: string; content: unknown }>);
			if (lastText) {
				const parsed = parseConditionResult(lastText);
				if (parsed) return parsed;
			}

			await session.prompt(
				'Your last response did not match the required format. Please reply with ONLY a JSON object like: {"result": "yes", "explanation": "reason"} or {"result": "no", "explanation": "reason"}. Nothing else.',
			);
		}

		// All retries exhausted
		return null;
	} finally {
		session.dispose();
	}
}
