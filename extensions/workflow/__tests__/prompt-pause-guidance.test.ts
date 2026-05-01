import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("workflow step prompt pause guidance", () => {
  it("instructs agents to use pause_workflow instead of normal assistant questions", () => {
    const content = readFileSync(
      join(process.cwd(), ".pi/extensions/workflow/prompts/step-message.md"),
      "utf-8",
    );

    expect(content).toContain("pause_workflow");
    expect(content).toContain("human advice");
    expect(content).toContain("Do not merely ask a question in normal assistant text");
    expect(content).toContain("workflow engine will consider this step finished");
    expect(content).toContain("automatically advance");
  });
});
