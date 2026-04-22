import { describe, it, expect, vi } from "vitest";
import { updateStatus } from "../runner.js";
import type { WorkflowState } from "../types.js";

describe("updateStatus", () => {
  it("includes the workflow ID in the status bar", () => {
    const setStatus = vi.fn();
    const state: WorkflowState = {
      active: {
        id: "workflow-123",
        config: {
          name: "CFG Simple Feature",
          steps: [
            { name: "Brainstorm", model: "mock-model", prompt: "Do it", maxExecutions: 1 },
          ],
        },
        currentStepIndex: 0,
        executionCounts: {},
      },
      allSkills: [],
      cwd: "",
      advancing: false,
      savedCommandCtx: null,
      originalModelId: null,
      originalThinkingLevel: null,
      originalModules: null,
      pendingConditionIndex: null,
      errorPaused: false,
    };

    updateStatus(state, {
      ui: {
        setStatus,
        theme: {
          fg: (_color: string, text: string) => text,
        },
      },
    } as any);

    expect(setStatus).toHaveBeenCalledWith(
      "workflow",
      "⚡ CFG Simple Feature [1/1] Brainstorm workflow-123",
    );
  });
});
