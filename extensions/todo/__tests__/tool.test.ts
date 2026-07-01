import { describe, it, expect, afterEach } from "vitest";
import { handleAdd } from "../add.js";
import { readStore } from "../../memory/store.js";
import { executeTodoAdd, executeTodoList, registerTodoTools } from "../tool.js";
import { makeStoreName, makeMockTex, purgeStore } from "../../testutils/index.js";

describe("executeTodoAdd", () => {
  const cwd = process.cwd();
  const stores: string[] = [];

  afterEach(() => {
    for (const store of stores) purgeStore(cwd, store);
    stores.length = 0;
  });

  it("stores agent-generated todos with AGENT prefixes", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);

    const result = await executeTodoAdd(cwd, "my-task", "Fix the bug", store);

    expect(result.content[0].text).toContain('Added todo "AGENT-1-my-task"');
    const data = readStore(cwd, store);
    const raw = Buffer.from(data!.entries["AGENT-1-my-task"], "base64").toString("utf-8");
    expect(JSON.parse(raw)).toEqual({
      name: "AGENT-1-my-task",
      description: "AGENT: Fix the bug",
      design: "",
    });
  });

  it("normalizes human-supplied agent todo titles", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);

    await executeTodoAdd(cwd, "Review analytics dashboard", "Later initiative", store);

    const data = readStore(cwd, store);
    expect(data?.entries["AGENT-1-Review-analytics-dashboard"]).toBeDefined();
  });
});

describe("registerTodoTools", () => {
  it("registers all todo tools with human-initiative warnings", () => {
    const tools: Array<{ name: string; description: string }> = [];
    const pi = {
      registerTool: (tool: { name: string; description: string }) => tools.push(tool),
      events: { emit: () => {} },
    } as any;

    registerTodoTools(pi);

    expect(tools.map((tool) => tool.name)).toEqual(["todo_add", "todo_list", "todo_design", "todo_complete"]);
    for (const tool of tools) {
      expect(tool.description).toContain("Do not use this tool for task-related work");
      expect(tool.description).toContain("long-term, human selected initiatives");
    }
  });
});

describe("executeTodoList", () => {
  const cwd = process.cwd();
  const stores: string[] = [];

  afterEach(() => {
    for (const store of stores) purgeStore(cwd, store);
    stores.length = 0;
  });

  it("returns 'No open todos.' when store is empty", () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);

    const result = executeTodoList(cwd, store);

    expect(result).toEqual({
      content: [{ type: "text", text: "No open todos." }],
    });
  });

  it("returns formatted list when entries exist", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex } = makeMockTex(cwd, store);

    await handleAdd(["add", "task-a", "First", "task"], tex);
    await handleAdd(["add", "task-b", "Second", "task"], tex);

    const result = executeTodoList(cwd, store);

    expect(result.content.length).toBe(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("• 1-task-a — First task");
    expect(result.content[0].text).toContain("• 2-task-b — Second task");
  });
});
