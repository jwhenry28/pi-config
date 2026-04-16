import type { ComponentTestSession } from "../../testutils/component/index.js";
import { createDummyModel } from "../../testutils/component/mock-stream.js";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import { setConditionStreamFnOverride } from "../evaluator.js";

/**
 * Register the mock model in the session's model registry so workflow
 * steps can look it up by ID, and add a dummy API key.
 *
 * Also registers under common alias-resolved IDs (claude-opus-4-6, etc.)
 * so real workflows using smart/fast/general aliases can find a model.
 */
export function registerMockModel(test: ComponentTestSession): void {
  const registry = test.session.modelRegistry as any;
  const model = { ...createDummyModel(), reasoning: true };

  if (!registry.models.some((m: any) => m.id === model.id)) {
    registry.models.push(model);
  }

  // Register under alias-resolved IDs so real workflows can resolve smart/fast/general
  for (const aliasId of ["claude-opus-4-6", "claude-haiku-4-5", "claude-sonnet-4-6"]) {
    if (!registry.models.some((m: any) => m.id === aliasId)) {
      registry.models.push({ ...model, id: aliasId });
    }
  }

  registry.authStorage.setRuntimeApiKey(model.provider, "mock-api-key");
}

/**
 * Run a workflow via runCommand, then provide mock responses for any
 * remaining steps that didn't get auto-responded.
 *
 * runCommand auto-responds to steps that start during its active window,
 * but autoAdvance setTimeout(0) chains can outrun the drain window,
 * leaving some steps waiting for responses.
 */
export async function runWorkflow(
  test: ComponentTestSession,
  command: string,
  expectedSteps: number,
): Promise<void> {
  await test.runCommand(command);
  // Allow any in-flight autoAdvance to fire
  await new Promise(r => setTimeout(r, 50));

  // Check how many steps completed, provide responses for the rest
  for (let attempt = 0; attempt < expectedSteps; attempt++) {
    const markers = test.events.customMessages("workflow:step-marker");
    const agentEnds = test.events.ofType("agent_end");
    if (agentEnds.length >= markers.length) break;

    // A step started but hasn't gotten a response
    await test.mockAgentResponse({ text: "" });
    await new Promise(r => setTimeout(r, 50));
  }

  await test.waitForIdle();
  // Final drain for completion notification
  await new Promise(r => setTimeout(r, 100));
}

/**
 * Build a mock partial message for the condition evaluator stream.
 */
function buildConditionPartial(content: any[], stopReason: string): any {
  return {
    role: "assistant",
    content,
    api: "anthropic-messages",
    provider: "anthropic",
    model: "mock-model",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason,
    timestamp: Date.now(),
  };
}

function emitTextResponse(stream: any, text: string): void {
  const partial = buildConditionPartial([{ type: "text", text }], "endTurn");
  stream.push({ type: "start", partial });
  stream.push({ type: "text_start", contentIndex: 0, partial });
  stream.push({ type: "text_delta", contentIndex: 0, delta: text, partial });
  stream.push({ type: "text_end", contentIndex: 0, partial });
  stream.push({ type: "done", reason: "endTurn", message: partial });
}

function emitToolCallResponse(stream: any, callId: string, result: string, explanation: string): void {
  const toolCall = {
    type: "toolCall" as const,
    id: callId,
    name: "evaluate_condition",
    arguments: { result, explanation },
  };
  const partial = buildConditionPartial([toolCall], "toolUse");
  stream.push({ type: "start", partial });
  stream.push({ type: "toolcall_start", contentIndex: 0, partial });
  stream.push({ type: "toolcall_delta", contentIndex: 0, delta: JSON.stringify(toolCall.arguments), partial });
  stream.push({ type: "toolcall_end", contentIndex: 0, toolCall, partial });
  stream.push({ type: "done", reason: "toolUse", message: { ...partial, content: [toolCall] } });
}

/**
 * Install a condition stream override that answers with the evaluate_condition tool.
 *
 * @param decideResult - Called for each non-follow-up condition evaluation.
 *   Receives the 1-based call index and returns `{ result, explanation }`.
 */
export function installConditionOverride(
  decideResult: (callIndex: number) => { result: string; explanation: string },
): { getCallCount: () => number } {
  let conditionCallCount = 0;
  let streamCallIndex = 0;

  setConditionStreamFnOverride((_model: any, context: any) => {
    streamCallIndex++;
    const stream = createAssistantMessageEventStream();
    const callIdx = streamCallIndex;

    const isFollowUp = context.messages?.some((m: any) => m.role === "toolResult");
    if (isFollowUp) {
      queueMicrotask(() => emitTextResponse(stream, "Condition evaluated."));
      return stream;
    }

    conditionCallCount++;
    const decision = decideResult(conditionCallCount);

    queueMicrotask(() => emitToolCallResponse(stream, `cond-tc-${callIdx}`, decision.result, decision.explanation));
    return stream;
  });

  return { getCallCount: () => conditionCallCount };
}

/**
 * Extract the workflow UUID from step message events.
 * The workflow runner sends a user message starting with "Workflow: <uuid>"
 * before the agent responds.
 */
export function parseWorkflowId(events: { ofType: (type: string) => any[] }): string {
  const messageStarts = events.ofType("message_start");
  for (const e of messageStarts) {
    const msg = (e as any).event?.message;
    if (msg?.role !== "user") continue;
    const parts = Array.isArray(msg.content) ? msg.content : [{ text: msg.content }];
    for (const part of parts) {
      const text = typeof part === "string" ? part : part?.text ?? "";
      const match = text.match(/Workflow:\s+([0-9a-f-]{36})/);
      if (match) return match[1];
    }
  }
  throw new Error("Could not find workflow ID in events");
}
