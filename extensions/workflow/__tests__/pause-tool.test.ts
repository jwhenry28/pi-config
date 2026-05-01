import { describe, it, expect, vi } from "vitest";
import { registerPauseWorkflowTool, executePauseWorkflow, PAUSE_WORKFLOW_TOOL } from "../pause-tool.js";
import { UNTAGGED_MODULE } from "../../modules/api.js";
import type { WorkflowState } from "../types.js";

function makeState(active = true): WorkflowState {
  return {
    active: active
      ? {
          id: "workflow-123",
          config: {
            name: "test-workflow",
            steps: [{ name: "Plan", model: "mock", prompt: "do it", maxExecutions: 1 }],
          },
          currentStepIndex: 0,
          executionCounts: { Plan: 1 },
        }
      : null,
    allSkills: [],
    cwd: "",
    advancing: false,
    savedCommandCtx: null,
    originalModelId: null,
    originalThinkingLevel: null,
    originalActiveTools: ["memory_get"],
    pendingConditionIndex: null,
    errorPaused: false,
  };
}

function makeCtx() {
  return {
    ui: { notify: vi.fn() },
  } as any;
}

describe("executePauseWorkflow", () => {
  it("sets errorPaused, notifies with reason, and tells the agent to stop", async () => {
    const state = makeState(true);
    const ctx = makeCtx();

    const result = await executePauseWorkflow(state, ctx, { reason: "Need the API contract" });

    expect(state.errorPaused).toBe(true);
    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "⏸️ Workflow paused: Need the API contract. Chat with the agent as needed, then use /workflow continue to retry this step or /workflow abort to cancel.",
      "warning",
    );
    expect(result.content[0].text).toContain("workflow is paused");
    expect(result.content[0].text).toContain("stop and wait for the user");
  });

  it("returns a harmless message when no workflow is active", async () => {
    const state = makeState(false);
    const ctx = makeCtx();

    const result = await executePauseWorkflow(state, ctx, { reason: "Need input" });

    expect(state.errorPaused).toBe(false);
    expect(ctx.ui.notify).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("No workflow is active");
  });

  it("uses a fallback reason when the provided reason is blank", async () => {
    const state = makeState(true);
    const ctx = makeCtx();

    const result = await executePauseWorkflow(state, ctx, { reason: "   " });

    expect(ctx.ui.notify).toHaveBeenCalledWith(
      "⏸️ Workflow paused: No reason provided. Chat with the agent as needed, then use /workflow continue to retry this step or /workflow abort to cancel.",
      "warning",
    );
    expect(result.content[0].text).toContain("The workflow is paused: No reason provided. Please stop and wait for the user.");
  });
});

describe("registerPauseWorkflowTool", () => {
  it("registers pause_workflow as an UNTAGGED tool with required reason", () => {
    const registered: any[] = [];
    const emitted: any[] = [];
    const pi: any = {
      registerTool: (tool: any) => registered.push(tool),
      events: {
        emit: (event: string, data: any) => emitted.push({ event, data }),
      },
    };
    const state = makeState(true);

    registerPauseWorkflowTool(pi, state);

    expect(registered).toHaveLength(1);
    expect(registered[0].name).toBe(PAUSE_WORKFLOW_TOOL);
    expect(emitted).toContainEqual({
      event: "module:tool-tag",
      data: { toolName: PAUSE_WORKFLOW_TOOL, moduleName: UNTAGGED_MODULE },
    });

    const schema = registered[0].parameters;
    expect(schema.required).toEqual(["reason"]);
  });
});
