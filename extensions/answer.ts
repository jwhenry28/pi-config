/**
 * Q&A extraction hook - extracts questions from assistant responses
 *
 * Custom interactive TUI for answering questions.
 *
 * Demonstrates the "prompt generator" pattern with custom TUI:
 * 1. /answer command gets the last assistant message
 * 2. Shows a spinner while extracting questions as structured JSON
 * 3. Presents an interactive TUI to navigate and answer questions
 * 4. Submits the compiled answers when done
 */

import {
  complete,
  type Model,
  type Api,
  type UserMessage,
} from "@mariozechner/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { BorderedLoader } from "@mariozechner/pi-coding-agent";
import { QnAComponent, formatAnswers, type QnAQuestion } from "./shared/qna/component.js";

// Structured output format for question extraction
interface ExtractionResult {
  questions: QnAQuestion[];
}

const SYSTEM_PROMPT = `You are a question extractor. Given text from a conversation, extract any questions that need answering.

Output a JSON object with this structure:
{
  "questions": [
    {
      "question": "The question text",
      "context": "Optional context that helps answer the question"
    }
  ]
}

Rules:
- Extract all questions that require user input
- Keep questions in the order they appeared
- Be concise with question text
- Include context only when it provides essential information for answering
- If no questions are found, return {"questions": []}

Example output:
{
  "questions": [
    {
      "question": "What is your preferred database?",
      "context": "We can only configure MySQL and PostgreSQL because of what is implemented."
    },
    {
      "question": "Should we use TypeScript or JavaScript?"
    }
  ]
}`;

const CODEX_MODEL_ID = "gpt-5.1-codex-mini";
const HAIKU_MODEL_ID = "claude-haiku-4-5";

/**
 * Prefer Codex mini for extraction when available, otherwise fallback to haiku or the current model.
 */
async function selectExtractionModel(
  currentModel: Model<Api>,
  modelRegistry: {
    find: (provider: string, modelId: string) => Model<Api> | undefined;
    getApiKey: (model: Model<Api>) => Promise<string | undefined>;
  },
): Promise<Model<Api>> {
  const codexModel = modelRegistry.find("openai-codex", CODEX_MODEL_ID);
  if (codexModel) {
    const apiKey = await modelRegistry.getApiKey(codexModel);
    if (apiKey) return codexModel;
  }

  const haikuModel = modelRegistry.find("anthropic", HAIKU_MODEL_ID);
  if (!haikuModel) return currentModel;

  const apiKey = await modelRegistry.getApiKey(haikuModel);
  if (!apiKey) return currentModel;

  return haikuModel;
}

/**
 * Parse the JSON response from the LLM
 */
function parseExtractionResult(text: string): ExtractionResult | null {
  try {
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.questions)) return parsed as ExtractionResult;
    return null;
  } catch {
    return null;
  }
}

/**
 * Find the last assistant message text on the current branch.
 */
function findLastAssistantText(ctx: ExtensionContext): string | undefined {
  const branch = ctx.sessionManager.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry.type === "message") {
      const msg = entry.message;
      if ("role" in msg && msg.role === "assistant") {
        if (msg.stopReason !== "stop") return undefined;
        const textParts = msg.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text);
        if (textParts.length > 0) return textParts.join("\n");
      }
    }
  }
  return undefined;
}

export default function (pi: ExtensionAPI) {
  const answerHandler = async (ctx: ExtensionContext) => {
    if (!ctx.hasUI) {
      ctx.ui.notify("answer requires interactive mode", "error");
      return;
    }
    if (!ctx.model) {
      ctx.ui.notify("No model selected", "error");
      return;
    }

    const lastAssistantText = findLastAssistantText(ctx);
    if (!lastAssistantText) {
      ctx.ui.notify("No assistant messages found", "error");
      return;
    }

    const extractionModel = await selectExtractionModel(ctx.model, ctx.modelRegistry);

    // Run extraction with loader UI
    const extractionResult = await ctx.ui.custom<ExtractionResult | null>(
      (tui, theme, _kb, done) => {
        const loader = new BorderedLoader(
          tui, theme, `Extracting questions using ${extractionModel.id}...`,
        );
        loader.onAbort = () => done(null);

        const doExtract = async () => {
          const apiKey = await ctx.modelRegistry.getApiKey(extractionModel);
          const userMessage: UserMessage = {
            role: "user",
            content: [{ type: "text", text: lastAssistantText }],
            timestamp: Date.now(),
          };
          const response = await complete(
            extractionModel,
            { systemPrompt: SYSTEM_PROMPT, messages: [userMessage] },
            { apiKey, signal: loader.signal },
          );
          if (response.stopReason === "aborted") return null;
          const responseText = response.content
            .filter((c): c is { type: "text"; text: string } => c.type === "text")
            .map((c) => c.text)
            .join("\n");
          return parseExtractionResult(responseText);
        };

        doExtract().then(done).catch(() => done(null));
        return loader;
      },
    );

    if (extractionResult === null) {
      ctx.ui.notify("Cancelled", "info");
      return;
    }
    if (extractionResult.questions.length === 0) {
      ctx.ui.notify("No questions found in the last message", "info");
      return;
    }

    // Show the Q&A component
    const answers = await ctx.ui.custom<string[] | null>(
      (tui, _theme, _kb, done) => new QnAComponent(extractionResult.questions, tui, done, { confirmMode: "always" }),
    );

    if (answers === null) {
      ctx.ui.notify("Cancelled", "info");
      return;
    }

    pi.sendMessage(
      {
        customType: "answers",
        content: "I answered your questions in the following way:\n\n" + formatAnswers(extractionResult.questions, answers),
        display: true,
      },
      { triggerTurn: true },
    );
  };

  pi.registerCommand("answer", {
    description: "Extract questions from last assistant message into interactive Q&A",
    handler: (_args, ctx) => answerHandler(ctx),
  });

  pi.registerShortcut("ctrl+.", {
    description: "Extract and answer questions",
    handler: answerHandler,
  });
}
