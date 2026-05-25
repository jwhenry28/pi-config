import { describe, it, expect, afterEach, vi } from "vitest";
import { handlePostStep, runCurrentStep } from "../runner.js";
import { createMemoryDomain, setWorkflowPrompt } from "../prompt-memory.js";
import { writeKey } from "../../memory/store.js";
import { purgeStore } from "../../testutils/index.js";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { PromptStep, WorkflowState, WorkflowConfig, CommandStep } from "../types.js";
import "../commands/memory-key-not-exists.js";

const cwd = process.cwd();

afterEach(() => {
  purgeStore(cwd, "wf-condition-explanation-test");
  vi.restoreAllMocks();
});

function makeCtx() {
  const notifications: { msg: string; level: string }[] = [];
  const ctx = {
    ui: {
      notify: (msg: string, level: string) => notifications.push({ msg, level }),
      setStatus: vi.fn(),
      theme: { fg: (_color: string, value: string) => value },
    },
    modelRegistry: {
      getAll: () => [{ id: "mock-model", provider: "mock", reasoning: true }],
      find: () => ({ id: "mock-model", provider: "mock", reasoning: true }),
    },
  } as unknown as ExtensionContext;
  return { ctx, notifications };
}

function makePi() {
  const userMessages: string[] = [];
  const pi = {
    sendMessage: vi.fn(),
    sendUserMessage: (msg: string) => userMessages.push(msg),
    setModel: vi.fn(async () => true),
    setThinkingLevel: vi.fn(),
    setActiveTools: vi.fn(),
    getAllTools: () => [],
    events: { emit: vi.fn() },
  } as unknown as ExtensionAPI;
  return { pi, userMessages };
}

function makeState(config: WorkflowConfig, currentStepIndex = 0): WorkflowState {
  return {
    active: {
      id: "wf-condition-explanation-test",
      config,
      currentStepIndex,
      executionCounts: {},
    },
    allSkills: [],
    cwd,
    advancing: false,
    savedCommandCtx: {
      waitForIdle: vi.fn(async () => undefined),
      ui: {
        notify: vi.fn(),
        setStatus: vi.fn(),
        theme: { fg: (_color: string, value: string) => value },
      },
      modelRegistry: {
        getAll: () => [{ id: "mock-model", provider: "mock", reasoning: true }],
        find: () => ({ id: "mock-model", provider: "mock", reasoning: true }),
      },
    } as any,
    originalModelId: null,
    originalThinkingLevel: null,
    originalActiveTools: null,
    pendingConditionIndex: null,
    errorPaused: false,
    conditionJumpContext: undefined,
  };
}

const workStep: PromptStep = {
  name: "Work",
  model: "mock-model",
  prompt: "Do work",
  maxExecutions: 10,
  conditions: [
    {
      command: "memory_key_not_exists",
      args: { memoryKey: "missing-key" },
      jump: "Review",
      explanation: "The TODO list still has unchecked items.",
    },
  ],
};

const reviewStep: PromptStep = {
  name: "Review",
  model: "mock-model",
  prompt: "Review work",
  maxExecutions: 10,
};

describe("workflow runner condition jump explanation", () => {
  it("injects static condition explanation after a real condition jump", async () => {
    const config: WorkflowConfig = { name: "test-flow", steps: [workStep, reviewStep] };
    const state = makeState(config);
    const { pi, userMessages } = makePi();
    const { ctx } = makeCtx();
    createMemoryDomain(cwd, state.active!.id);
    setWorkflowPrompt(cwd, state.active!.id, "Top-level goal");
    writeKey(
      cwd,
      state.active!.id,
      "workflow-condition-result",
      JSON.stringify({ result: "true", explanation: "runtime evaluator explanation" }),
    );

    await handlePostStep(pi, state, ctx, workStep);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(userMessages[0]).toContain(
      "The reason for this move is: _The TODO list still has unchecked items._",
    );
    expect(userMessages[0]).not.toContain("runtime evaluator explanation");
    expect(state.conditionJumpContext).toBeUndefined();
  });

  it("does not inject explanation when maxExecutions prevents the jump", async () => {
    const cappedReview: PromptStep = { ...reviewStep, maxExecutions: 1 };
    const nextStep: PromptStep = { name: "Done", model: "mock-model", prompt: "Done", maxExecutions: 10 };
    const config: WorkflowConfig = { name: "test-flow", steps: [workStep, cappedReview, nextStep] };
    const state = makeState(config);
    state.active!.executionCounts.Review = 1;
    const { pi, userMessages } = makePi();
    const { ctx } = makeCtx();
    createMemoryDomain(cwd, state.active!.id);
    setWorkflowPrompt(cwd, state.active!.id, "Top-level goal");
    writeKey(
      cwd,
      state.active!.id,
      "workflow-condition-result",
      JSON.stringify({ result: "true", explanation: "runtime evaluator explanation" }),
    );

    await handlePostStep(pi, state, ctx, workStep);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(state.conditionJumpContext).toBeUndefined();
    expect(userMessages.join("\n")).not.toContain("condition caused to you move to this step");
  });

  it("clears jump context when the jumped-to step is a command step", async () => {
    const commandStep: CommandStep = {
      name: "CommandTarget",
      command: "nonexistent-test-command",
      maxExecutions: 10,
    };
    const config: WorkflowConfig = { name: "test-flow", steps: [commandStep] };
    const state = makeState(config);
    state.conditionJumpContext = {
      previousStepName: "Work",
      explanation: "Should not leak",
    };
    const { pi } = makePi();
    const { ctx } = makeCtx();

    await runCurrentStep(pi, state, ctx);

    expect(state.conditionJumpContext).toBeUndefined();
  });
});
