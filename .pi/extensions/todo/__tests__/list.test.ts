import { describe, it, expect, afterEach } from "vitest";
import { handleAdd } from "../add.js";
import { formatTodoList, handleList } from "../list.js";
import { makeStoreName, makeMockTex, purgeStore } from "../../testutils/index.js";

describe("formatTodoList", () => {
  const cwd = process.cwd();
  const stores: string[] = [];

  afterEach(() => {
    for (const store of stores) purgeStore(cwd, store);
    stores.length = 0;
  });

  it("returns null when store is empty", () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    expect(formatTodoList(cwd, store)).toBeNull();
  });

  it("returns formatted bullet list", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex } = makeMockTex(cwd, store);

    await handleAdd(["add", "task-a", "First", "task"], tex);
    await handleAdd(["add", "task-b", "Second", "task"], tex);

    const result = formatTodoList(cwd, store);
    expect(result).toContain("• task-a — First task");
    expect(result).toContain("• task-b — Second task");
  });
});

describe("handleList", () => {
  const cwd = process.cwd();
  const stores: string[] = [];

  afterEach(() => {
    for (const store of stores) purgeStore(cwd, store);
    stores.length = 0;
  });

  it("notifies 'No open todos' when empty", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleList(tex);

    expect(notifications).toEqual([{ msg: "No open todos", level: "info" }]);
  });

  it("notifies with todo list when entries exist", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleAdd(["add", "my-task", "Do", "something"], tex);
    notifications.length = 0;

    await handleList(tex);

    expect(notifications.length).toBe(1);
    expect(notifications[0].level).toBe("info");
    expect(notifications[0].msg).toContain("• my-task — Do something");
  });
});
