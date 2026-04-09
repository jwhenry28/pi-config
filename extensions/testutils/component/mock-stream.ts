import {
  type AssistantMessage,
  type Model,
  type Api,
  type Context,
  type SimpleStreamOptions,
  type ToolCall,
  createAssistantMessageEventStream,
} from "@mariozechner/pi-ai";

// ── Types ──────────────────────────────────────────────────────────

export interface ScriptedToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ScriptedResponse {
  text?: string;
  toolCalls?: ScriptedToolCall[];
  thinking?: string;
  /** If set, emits an error stream event with this message. Simulates API errors. */
  error?: string;
}

// ── Dummy Model ────────────────────────────────────────────────────

export function createDummyModel(): Model<any> {
  return {
    id: "mock-model",
    name: "Mock Model",
    api: "anthropic-messages" as Api,
    provider: "anthropic",
    baseUrl: "https://mock.invalid",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 8192,
  };
}

// ── Mock Stream Controller ─────────────────────────────────────────

/**
 * Controls the mock LLM stream for component tests.
 *
 * The agent loop calls streamFn when it needs an LLM response.
 * Test code calls provide() to deliver a scripted response.
 * provide() waits for streamFn to be called, delivers the response,
 * then waits for the response to be consumed (next streamFn call or idle).
 */
export class MockStreamController {
  // When true, streamFn auto-responds with empty text if no provide() is pending.
  // Used by runCommand() so agent turns triggered by pi.sendUserMessage() complete silently.
  private _autoRespond = false;

  // Resolves the response promise inside streamFn so it can emit
  private _responseResolve: ((response: ScriptedResponse) => void) | null = null;

  // Resolves when streamFn is called (so provide() knows the agent is waiting)
  private _streamFnReadyResolve: (() => void) | null = null;
  private _streamFnReadyPromise: Promise<void>;

  // Resolves when the response is consumed (next streamFn call or idle)
  private _consumedResolve: (() => void) | null = null;
  private _consumedPromise: Promise<void> | null = null;

  constructor() {
    this._streamFnReadyPromise = new Promise<void>((r) => {
      this._streamFnReadyResolve = r;
    });
  }

  private _prepareStreamFnReadySlot(): void {
    this._streamFnReadyPromise = new Promise<void>((r) => {
      this._streamFnReadyResolve = r;
    });
  }

  private _prepareConsumedSlot(): void {
    this._consumedPromise = new Promise<void>((resolve) => {
      this._consumedResolve = resolve;
    });
  }

  /**
   * The stream function to wire into the agent.
   * Arrow function so `this` is bound correctly.
   */
  streamFn = (
    _model: Model<any>,
    _context: Context,
    _options?: SimpleStreamOptions
  ) => {
    // Signal that the previous response was consumed
    if (this._consumedResolve) {
      this._consumedResolve();
      this._consumedResolve = null;
      this._consumedPromise = null;
    }

    // Auto-respond mode: immediately return an empty response
    if (this._autoRespond) {
      const stream = createAssistantMessageEventStream();
      queueMicrotask(() => this._emitResponse(stream, { text: "" }));
      return stream;
    }

    // Create a response promise that provide() will resolve
    const responsePromise = new Promise<ScriptedResponse>((resolve) => {
      this._responseResolve = resolve;
    });

    // Signal that streamFn has been called and is waiting
    if (this._streamFnReadyResolve) {
      this._streamFnReadyResolve();
      this._streamFnReadyResolve = null;
    }

    // Return a stream that waits for provide() to deliver a response
    const stream = createAssistantMessageEventStream();

    queueMicrotask(async () => {
      const response = await responsePromise;
      this._emitResponse(stream, response);
    });

    return stream;
  };

  /**
   * Provide a scripted response to the agent loop.
   * Waits for the agent to call streamFn, delivers the response,
   * then waits until the response is consumed.
   * Times out after 5 seconds.
   */
  async provide(response: ScriptedResponse): Promise<void> {
    const timeout = (msg: string) =>
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(msg)), 5000));

    // Wait for streamFn to be called
    await Promise.race([
      this._streamFnReadyPromise,
      timeout("mockAgentResponse timed out — agent loop never called streamFn"),
    ]);

    // Set up consumed tracking
    this._prepareConsumedSlot();

    // Prepare for the next streamFn call
    this._prepareStreamFnReadySlot();

    // Deliver the response
    this._responseResolve!(response);
    this._responseResolve = null;

    // Wait for consumption
    await Promise.race([
      this._consumedPromise!,
      timeout("mockAgentResponse timed out — response never consumed"),
    ]);
  }

  /**
   * Enable or disable auto-respond mode.
   * When enabled, streamFn immediately returns an empty response
   * instead of waiting for provide().
   */
  setAutoRespond(enabled: boolean): void {
    this._autoRespond = enabled;
  }

  /**
   * Call this when the agent goes idle to unblock any pending provide() call.
   */
  notifyIdle(): void {
    if (this._consumedResolve) {
      this._consumedResolve();
      this._consumedResolve = null;
      this._consumedPromise = null;
    }
  }

  private _emitResponse(stream: ReturnType<typeof createAssistantMessageEventStream>, response: ScriptedResponse): void {
    const content: AssistantMessage["content"] = [];
    let contentIndex = 0;

    const partial: AssistantMessage = {
      role: "assistant",
      content,
      api: "anthropic-messages" as Api,
      provider: "anthropic",
      model: "mock-model",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop",
      timestamp: Date.now(),
    };

    stream.push({ type: "start", partial });

    if (response.thinking) {
      const idx = contentIndex++;
      content.push({ type: "thinking", thinking: "", thinkingSignature: "" });
      stream.push({ type: "thinking_start", contentIndex: idx, partial });
      stream.push({ type: "thinking_delta", contentIndex: idx, delta: response.thinking, partial });
      (content[idx] as any).thinking = response.thinking;
      stream.push({ type: "thinking_end", contentIndex: idx, content: response.thinking, partial });
    }

    if (response.text) {
      const idx = contentIndex++;
      content.push({ type: "text", text: "" });
      stream.push({ type: "text_start", contentIndex: idx, partial });
      stream.push({ type: "text_delta", contentIndex: idx, delta: response.text, partial });
      (content[idx] as any).text = response.text;
      stream.push({ type: "text_end", contentIndex: idx, content: response.text, partial });
    }

    if (response.toolCalls) {
      for (const tc of response.toolCalls) {
        const idx = contentIndex++;
        const toolCall: ToolCall = {
          type: "toolCall",
          id: `mock-tc-${idx}`,
          name: tc.name,
          arguments: tc.args,
        };
        content.push(toolCall);
        stream.push({ type: "toolcall_start", contentIndex: idx, partial });
        stream.push({
          type: "toolcall_delta",
          contentIndex: idx,
          delta: JSON.stringify(tc.args),
          partial,
        });
        stream.push({ type: "toolcall_end", contentIndex: idx, toolCall, partial });
      }
    }

    if (response.error) {
      partial.stopReason = "error";
      (partial as any).errorMessage = response.error;
      const finalMessage = { ...partial, content: [...content] };
      stream.push({ type: "error", reason: "error" as any, error: finalMessage });
    } else {
      const stopReason = response.toolCalls?.length ? "toolUse" : "stop";
      partial.stopReason = stopReason;
      const finalMessage = { ...partial, content: [...content] };
      stream.push({ type: "done", reason: stopReason as any, message: finalMessage });
    }
  }
}
