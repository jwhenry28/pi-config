import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it, expect } from "vitest";
import { createMemoryDomain, getWorkflowPrompt, setWorkflowPrompt, WORKFLOW_PROMPT_KEY } from "../prompt-memory.js";
import { registerMockModel, runWorkflow, parseWorkflowId } from "./helpers.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("test helpers", () => {
  it("exports all helper functions", () => {
    expect(typeof registerMockModel).toBe("function");
    expect(typeof runWorkflow).toBe("function");
  });
});

describe("workflow prompt memory helpers", () => {
  it("reads and writes workflow-prompt in workflow memory", () => {
    const cwd = mkdtempSync(join(tmpdir(), "workflow-prompt-"));
    tempDirs.push(cwd);
    const workflowId = "wf-test-1";

    createMemoryDomain(cwd, workflowId);
    setWorkflowPrompt(cwd, workflowId, "Initial prompt");

    expect(getWorkflowPrompt(cwd, workflowId)).toBe("Initial prompt");
    expect(WORKFLOW_PROMPT_KEY).toBe("workflow-prompt");
  });

  it("throws a clear error when workflow-prompt is missing", () => {
    const cwd = mkdtempSync(join(tmpdir(), "workflow-prompt-"));
    tempDirs.push(cwd);
    const workflowId = "wf-test-2";

    createMemoryDomain(cwd, workflowId);

    expect(() => getWorkflowPrompt(cwd, workflowId)).toThrow(/Missing workflow prompt in memory/);
  });
});

describe("parseWorkflowId", () => {
  it("extracts UUID from user message events", () => {
    const fakeEvents = {
      ofType: (type: string) => {
        if (type === "message_start") {
          return [
            {
              event: {
                message: {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Workflow: abc12345-def6-7890-abcd-ef1234567890\n\nYou are running one step...",
                    },
                  ],
                },
              },
            },
          ];
        }
        return [];
      },
    };
    expect(parseWorkflowId(fakeEvents as any)).toBe("abc12345-def6-7890-abcd-ef1234567890");
  });

  it("throws when no workflow ID found", () => {
    const fakeEvents = {
      ofType: () => [],
    };
    expect(() => parseWorkflowId(fakeEvents as any)).toThrow("Could not find workflow ID");
  });
});
