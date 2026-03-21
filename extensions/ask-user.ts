/**
 * ask_user tool — lets the LLM ask the user questions mid-conversation.
 *
 * Accepts a single question or a list of questions. Multiple questions are
 * presented in a multi-step Q&A UI (same flow as /answer). Concurrent calls
 * within the same turn are also batched into a single UI.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { moduleTag } from "./modules/api.js";
import { QnAComponent, type QnAQuestion } from "./shared/qna-component.js";

/** A pending batch of questions waiting to be shown in the Q&A UI. */
interface PendingBatch {
  questions: QnAQuestion[];
  resolve: (answers: (string | undefined)[] | undefined) => void;
}

/**
 * Collect concurrent ask_user calls into a single UI.
 *
 * The first call in a microtask creates the batch; subsequent calls within the
 * same microtask join it. After the microtask drains, the Q&A UI is shown.
 */
function createBatcher() {
  let pending: PendingBatch[] | null = null;
  let ctxRef: ExtensionContext | null = null;

  return function enqueue(questions: QnAQuestion[], ctx: ExtensionContext): Promise<(string | undefined)[] | undefined> {
    return new Promise<(string | undefined)[] | undefined>((resolve) => {
      const isFirst = pending === null;
      if (isFirst) {
        pending = [];
        ctxRef = ctx;
      }
      pending!.push({ questions, resolve });

      if (isFirst) {
        Promise.resolve().then(() => flush());
      }
    });
  };

  async function flush() {
    const batches = pending!;
    const ctx = ctxRef!;
    pending = null;
    ctxRef = null;

    // Flatten all questions from all concurrent calls
    const allQuestions: QnAQuestion[] = [];
    const offsets: number[] = []; // start index per batch
    for (const batch of batches) {
      offsets.push(allQuestions.length);
      allQuestions.push(...batch.questions);
    }

    const answers = await ctx.ui.custom<string[] | null>(
      (tui, _theme, _kb, done) => new QnAComponent(allQuestions, tui, done, { confirmMode: "multi" }),
    );

    // Distribute answers back to each caller
    for (let i = 0; i < batches.length; i++) {
      if (!answers) {
        batches[i].resolve(undefined);
      } else {
        const start = offsets[i];
        const count = batches[i].questions.length;
        batches[i].resolve(answers.slice(start, start + count));
      }
    }
  }
}

export default function (pi: ExtensionAPI) {
  const enqueue = createBatcher();

  pi.registerTool(
    {
      name: "ask_user",
      label: "Ask User",
      description:
        "Ask the user one or more questions and wait for their answers. You MUST use this tool whenever you need to ask the user anything — never ask questions in plain text. Supports free-text input or multiple-choice selection. When you have multiple questions, pass them all at once.",
      promptGuidelines: [
        "When you need to ask the user a question, ALWAYS use the ask_user tool instead of writing the question as text. This ensures the user gets a proper input prompt.",
        "When you have multiple questions, pass them ALL in the `questions` array in a single tool call rather than making separate calls.",
      ],
      parameters: Type.Object({
        questions: Type.Array(
          Type.Object({
            question: Type.String({ description: "The question to ask" }),
            options: Type.Optional(
              Type.Array(Type.String(), {
                description: "If provided, show as multiple-choice options instead of free-text input. Note - the user will always get one \"Something else?\" free-form option.",
              }),
            ),
          }),
          { description: "One or more questions to ask the user", minItems: 1 },
        ),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        if (signal?.aborted) {
          return { content: [{ type: "text" as const, text: "Cancelled" }], details: undefined };
        }

        const questions: QnAQuestion[] = params.questions.map((q) => ({
          question: q.question,
          options: q.options && q.options.length > 0 ? q.options : undefined,
        }));

        const answers = await enqueue(questions, ctx);

        if (!answers) {
          return {
            content: [{ type: "text" as const, text: "The user dismissed the questions without answering." }],
            details: undefined,
          };
        }

        const lines = questions.map((q, i) => {
          const answer = answers[i]?.trim() || "(no answer)";
          return `Q: ${q.question}\nA: ${answer}`;
        });

        return {
          content: [{ type: "text" as const, text: lines.join("\n\n") }],
          details: undefined,
        };
      },
    },
  );
}
