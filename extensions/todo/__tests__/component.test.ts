import { describe, it, expect, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createComponentTest, type ComponentTestSession } from "../../testutils/component/index.js";

const BRAINSTORMING_SKILL = [
  "---",
  "name: brainstorming",
  "description: Brainstorming skill for design",
  "---",
  "# Brainstorming",
  "FAKE_BRAINSTORMING_CONTENT",
].join("\n");

describe("todo extension (component)", () => {
  let test: ComponentTestSession | undefined;

  afterEach(() => {
    test?.dispose();
    test = undefined;
  });

  it("adds a todo via slash command", async () => {
    test = await createComponentTest();

    test.sendUserMessage("/todo add task-1 Build the feature");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: 'Added todo "1-task-1"\n\n• 1-task-1 — Build the feature',
      })
    );
  });

  it("lists todos via slash command", async () => {
    test = await createComponentTest();

    test.sendUserMessage("/todo add task-b Another task");
    test.sendUserMessage("/todo list");

    expect(test.events.ofType("turn_end")).toHaveLength(0);

    const listNotification = test.notifications.find((n) =>
      n.message.includes("1-task-b") && n.message.includes("Another task")
    );
    expect(listNotification).toBeDefined();
  });

  it("completes a todo via slash command", async () => {
    test = await createComponentTest();

    // 1. Add a todo
    test.sendUserMessage("/todo add complete-me A task to complete");
    await test.waitForIdle();

    // 2. Verify it was added
    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: 'Added todo "1-complete-me"\n\n• 1-complete-me — A task to complete',
      })
    );

    // 3. Complete the todo (ui.confirm returns false by default in component tests)
    // The default confirm mock returns false, so the command will be cancelled.
    test.sendUserMessage("/todo complete 1-complete-me");
    await test.waitForIdle();

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: "Cancelled" })
    );
  });

  it("designs a todo via slash command", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "brainstorming", content: BRAINSTORMING_SKILL }],
    });

    // 1. Add a todo first
    test.sendUserMessage("/todo add design-task Build a widget");
    await test.waitForIdle();

    // 2. Clear events from the add command
    test.events.clear();

    // 3. Run the design command
    await test.runCommand("/todo design 1-design-task");

    // 4. Assert: skill was injected
    const customs = test.events.customMessages("todo:skill");
    expect(customs).toHaveLength(1);
    expect(customs[0].content).toContain("brainstorming");
    expect(customs[0].details).toEqual(
      expect.objectContaining({ skillName: "brainstorming" })
    );

    // 5. Assert: design prompt was sent
    const userMessageEvents = test.events.all.filter(
      (e) => e.type === "message_start" && (e.event as any).message?.role === "user"
    );
    const hasDesignPrompt = userMessageEvents.some((e) => {
      const msg = (e.event as any).message;
      const text = Array.isArray(msg.content)
        ? msg.content.map((c: any) => c.text ?? "").join("")
        : typeof msg.content === "string" ? msg.content : "";
      return (
        text.includes("1-design-task")
        && text.includes("Build a widget")
        && text.includes("todos/1-design-task.md")
      );
    });
    expect(hasDesignPrompt).toBe(true);

    // 6. Assert: design file was created
    expect(existsSync(join(test.cwd, "todos", "1-design-task.md"))).toBe(true);
  });
});
