import { describe, it, expect, afterEach } from "vitest";
import { handleAdd } from "../add.js";
import { readStore } from "../../memory/store.js";
import { makeStoreName, makeMockTex, purgeStore } from "../../testutils/index.js";

describe("handleAdd", () => {
  const cwd = process.cwd();
  const stores: string[] = [];

  afterEach(() => {
    for (const store of stores) purgeStore(cwd, store);
    stores.length = 0;
  });

  it("adds a todo to the store", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleAdd(["add", "my-task", "Fix", "the", "bug"], tex);

    expect(notifications).toEqual([{ msg: 'Added todo "my-task"', level: "info" }]);

    const data = readStore(cwd, store);
    expect(data).not.toBeNull();
    const raw = Buffer.from(data!.entries["my-task"], "base64").toString("utf-8");
    const todo = JSON.parse(raw);
    expect(todo).toEqual({ name: "my-task", description: "Fix the bug", design: "" });
  });

  it("rejects missing name", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleAdd(["add"], tex);

    expect(notifications).toEqual([{ msg: "Usage: /todo add <name> <description>", level: "warning" }]);
    expect(readStore(cwd, store)).toBeNull();
  });

  it("rejects missing description", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleAdd(["add", "my-task"], tex);

    expect(notifications).toEqual([{ msg: "Usage: /todo add <name> <description>", level: "warning" }]);
  });

  it("rejects invalid name", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleAdd(["add", "bad name!", "some", "desc"], tex);

    expect(notifications[0].level).toBe("error");
    expect(notifications[0].msg).toContain("Invalid name");
  });

  it("rejects duplicate name", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleAdd(["add", "dup", "first", "desc"], tex);
    await handleAdd(["add", "dup", "second", "desc"], tex);

    expect(notifications[1].level).toBe("warning");
    expect(notifications[1].msg).toContain("already exists");
  });
});
