import { describe, it, expect } from "vitest";
import { registerMockModel, runWorkflow, parseWorkflowId } from "./helpers.js";

describe("test helpers", () => {
  it("exports all helper functions", () => {
    expect(typeof registerMockModel).toBe("function");
    expect(typeof runWorkflow).toBe("function");
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
