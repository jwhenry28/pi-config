/**
 * ask_user tool — lets the LLM ask the user questions mid-conversation.
 *
 * Accepts a single question or a list of questions. Multiple questions are
 * presented in a multi-step Q&A UI (same flow as /answer). Concurrent calls
 * within the same turn are also batched into a single UI.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { moduleTag } from "./modules/api.js";
import { QnAComponent, type QnAQuestion } from "./shared/qna-component.js";

/** Maximum length (in characters) for a single question's text. Questions
 *  exceeding this limit are rejected so the model learns to present lengthy
 *  context as a normal assistant message before calling ask_user. */
const MAX_QUESTION_LENGTH = 1024;

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

  return function enqueue(
    questions: QnAQuestion[],
    ctx: ExtensionContext,
  ): Promise<(string | undefined)[] | undefined> {
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
      (tui, _theme, _kb, done) =>
        new QnAComponent(allQuestions, tui, done, { confirmMode: "multi" }),
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
    moduleTag(pi, "ask", {
      name: "ask_user",
      label: "Ask User",
      description:
        "Ask the user questions and wait for their answers. Supports free-text input or multiple-choice selection. When you have multiple questions, pass them all at once. Each question must be concise (max 1024 chars) — if you need to present analysis or context, write it as a normal assistant message first, then call this tool with only the questions.",
      promptGuidelines: [
        "Use ask_user for ALL questions directed at the user — clarifications, multiple-choice selections, design decisions, yes/no confirmations. Batch related questions into a single call using the `questions` array. This gives the user a proper input prompt.",
        "The ONE exception: when presenting large content blocks (design sections, plans, documents) for review, write those as normal text and let the user respond naturally. Don't funnel \"here's a 300-word design section, does this look right?\" through ask_user.",
        "When you have multiple questions, pass them ALL in the `questions` array in a single tool call rather than making separate calls.",
        "Keep each question concise. If you have context or analysis to share (e.g. what you found in the codebase, trade-offs between approaches), write that as a normal assistant message FIRST, then call ask_user with just the questions. The tool will reject questions longer than 1024 characters.",
      ],
      parameters: Type.Object({
        questions: Type.Array(
          Type.Object({
            question: Type.String({ description: "The question to ask" }),
            options: Type.Optional(
              Type.Array(Type.String(), {
                description:
                  'If provided, show as multiple-choice options instead of free-text input. Note - the user will always get one "Something else?" free-form option.',
              }),
            ),
          }),
          { description: "One or more questions to ask the user", minItems: 1 },
        ),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        if (signal?.aborted) {
          return {
            content: [{ type: "text" as const, text: "Cancelled" }],
            details: undefined,
          };
        }

        // Reject questions that are too long — force the model to present
        // context as a normal assistant message before calling ask_user.
        const tooLong = params.questions
          .map((q, i) => ({ index: i + 1, length: q.question.length }))
          .filter((q) => q.length > MAX_QUESTION_LENGTH);

        if (tooLong.length > 0) {
          const details = tooLong
            .map((q) => `  Question ${q.index}: ${q.length} chars`)
            .join("\n");
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `${tooLong.length === 1 ? "A question exceeds" : `${tooLong.length} questions exceed`} the maximum length of ${MAX_QUESTION_LENGTH} characters:\n${details}\n\n` +
                  "Present your analysis/context as a regular assistant message first, then call ask_user again with only the concise questions.",
              },
            ],
            details: undefined,
          };
        }

        const questions: QnAQuestion[] = params.questions.map((q) => ({
          question: q.question,
          options: q.options && q.options.length > 0 ? q.options : undefined,
        }));

        const answers = await enqueue(questions, ctx);

        if (!answers) {
          return {
            content: [
              {
                type: "text" as const,
                text: "The user dismissed the questions without answering.",
              },
            ],
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
    }),
  );
}
