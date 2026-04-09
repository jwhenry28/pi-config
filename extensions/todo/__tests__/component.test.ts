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
      expect.objectContaining({ message: 'Added todo "task-1"' })
    );
  });

  it("adds a todo then lists via agent tool call", async () => {
    test = await createComponentTest({ shownModules: ["agent-todo"] });

    test.sendUserMessage("/todo add task-a Do the thing");
    await test.waitForIdle();

    test.sendUserMessage("list my todos");

    await test.mockAgentResponse({ toolCalls: [{ name: "todo_list", args: {} }] });

    const calls = test.events.toolCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].toolName).toBe("todo_list");
    
    const results = test.events.toolResults();
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(results[0].result)).toContain("task-a");
  });

  it("lists todos via slash command", async () => {
    test = await createComponentTest();

    test.sendUserMessage("/todo add task-b Another task");
    test.sendUserMessage("/todo list");

    expect(test.events.ofType("turn_end")).toHaveLength(0);

    const listNotification = test.notifications.find((n) =>
      n.message.includes("task-b") && n.message.includes("Another task")
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
      expect.objectContaining({ message: 'Added todo "complete-me"' })
    );

    // 3. Complete the todo (ui.confirm returns false by default in component tests)
    // The default confirm mock returns false, so the command will be cancelled.
    test.sendUserMessage("/todo complete complete-me");
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
    await test.runCommand("/todo design design-task");

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
      return text.includes("design-task") && text.includes("Build a widget");
    });
    expect(hasDesignPrompt).toBe(true);

    // 6. Assert: design file was created
    expect(existsSync(join(test.cwd, "todos", "design-task.md"))).toBe(true);
  });
});
