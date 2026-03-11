import { describe, it, expect, afterEach } from "vitest";
import { handleAdd } from "../add.js";
import { executeTodoList } from "../tool.js";
import { makeStoreName, makeMockTex, purgeStore } from "../../testutils/index.js";

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
    expect(result.content[0].text).toContain("• task-a — First task");
    expect(result.content[0].text).toContain("• task-b — Second task");
  });
});
