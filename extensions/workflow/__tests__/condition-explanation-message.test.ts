import { describe, it, expect } from "vitest";
import { buildMessage } from "../runner.js";
import type { PromptStep } from "../types.js";

const step: PromptStep = {
  name: "Implement",
  model: "mock-model",
  prompt: "Implement the feature",
  maxExecutions: 10,
};

describe("workflow step message condition jump explanation", () => {
  it("includes the required paragraph when condition jump context is present", () => {
    const message = buildMessage(
      step,
      "Implement the feature",
      "workflow-123",
      "Extension Implementation",
      "Add condition explanations",
      {
        previousStepName: "Plan",
        explanation: "There is still at least one remaining TODO item.",
      },
    );

    expect(message).toContain(
      "You previously executed step Plan, and a condition caused to you move to this step. The reason for this move is: There is still at least one remaining TODO item.. Make sure to consider this reason, as it may dictate how you approach this current step (e.g., if the previous step failed for a particular reason.)",
    );
    expect(message.indexOf("There is still at least one remaining TODO item.")).toBeGreaterThan(
      message.indexOf("Add condition explanations"),
    );
    expect(message.indexOf("There is still at least one remaining TODO item.")).toBeLessThan(
      message.indexOf("You are currently on step 'Implement'"),
    );
  });

  it("adds no condition jump paragraph when context is absent", () => {
    const message = buildMessage(
      step,
      "Implement the feature",
      "workflow-123",
      "Extension Implementation",
      "Add condition explanations",
    );

    expect(message).not.toContain("condition caused to you move to this step");
    expect(message).not.toContain("%CONDITION_JUMP_EXPLANATION%");
    expect(message).toContain("You are currently on step 'Implement'. For this step, you must:");
  });
});
