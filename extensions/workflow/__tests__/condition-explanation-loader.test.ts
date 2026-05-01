import { describe, it, expect, afterEach } from "vitest";
import { loadWorkflowFile } from "../loader.js";
import { writeWorkflow } from "../../testutils/fixtures.js";
import type { CommandCondition, PromptCondition } from "../types.js";
import { purgeStore } from "../../testutils/index.js";

const cwd = process.cwd();

afterEach(() => {
  purgeStore(cwd, "pi-config");
});

describe("workflow condition explanation loading", () => {
  it("loads explanation on command conditions", () => {
    writeWorkflow(cwd, "condition-explanation-command", {
      name: "condition-explanation-command",
      steps: [
        {
          name: "Work",
          prompt: "Do work",
          model: "mock-model",
          conditions: [
            {
              command: "incomplete-todos-remaining",
              args: { todoFilepath: "todo.md" },
              jump: "Work",
              explanation: "There is still at least one TODO item.",
            },
          ],
        },
      ],
    });

    const config = loadWorkflowFile("condition-explanation-command", cwd);
    const cond = config.steps[0].conditions![0] as CommandCondition;

    expect(cond.explanation).toBe("There is still at least one TODO item.");
  });

  it("loads explanation on prompt conditions", () => {
    writeWorkflow(cwd, "condition-explanation-prompt", {
      name: "condition-explanation-prompt",
      steps: [
        {
          name: "Check",
          prompt: "Check work",
          model: "mock-model",
          conditions: [
            {
              prompt: "Is more work needed?",
              model: "mock-model",
              jump: "Check",
              explanation: "The previous answer said more work remains.",
            },
          ],
        },
      ],
    });

    const config = loadWorkflowFile("condition-explanation-prompt", cwd);
    const cond = config.steps[0].conditions![0] as PromptCondition;

    expect(cond.explanation).toBe("The previous answer said more work remains.");
  });

  it("normalizes empty and whitespace-only explanations to undefined", () => {
    writeWorkflow(cwd, "condition-explanation-empty", {
      name: "condition-explanation-empty",
      steps: [
        {
          name: "Work",
          prompt: "Do work",
          model: "mock-model",
          conditions: [
            {
              command: "incomplete-todos-remaining",
              args: { todoFilepath: "todo.md" },
              jump: "Work",
              explanation: "   ",
            },
            {
              prompt: "Retry?",
              model: "mock-model",
              jump: "Work",
              explanation: "",
            },
          ],
        },
      ],
    });

    const config = loadWorkflowFile("condition-explanation-empty", cwd);

    expect(config.steps[0].conditions![0].explanation).toBeUndefined();
    expect(config.steps[0].conditions![1].explanation).toBeUndefined();
  });

  it("throws a helpful error for non-string explanations", () => {
    writeWorkflow(cwd, "condition-explanation-invalid", {
      name: "condition-explanation-invalid",
      steps: [
        {
          name: "Work",
          prompt: "Do work",
          model: "mock-model",
          conditions: [
            {
              command: "incomplete-todos-remaining",
              args: { todoFilepath: "todo.md" },
              jump: "Work",
              explanation: 123,
            },
          ],
        },
      ],
    });

    expect(() => loadWorkflowFile("condition-explanation-invalid", cwd)).toThrow(
      "Step 1, condition 1: 'explanation' must be a string",
    );
  });
});
