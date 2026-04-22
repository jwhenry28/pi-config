import { describe, it, expect, afterEach } from "vitest";
import { handleAdd } from "../add.js";
import { handleComplete, getTodoCompletions } from "../complete.js";
import { readStore, ensureStore } from "../../memory/store.js";
import { makeStoreName, makeMockTex, purgeStore } from "../../testutils/index.js";
import type { AutocompleteItem } from "@mariozechner/pi-tui";

describe("handleComplete", () => {
  const cwd = process.cwd();
  const stores: string[] = [];

  afterEach(() => {
    for (const store of stores) purgeStore(cwd, store);
    stores.length = 0;
  });

  it("completes a todo when confirmed", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store, {
      confirm: async () => true,
    });

    await handleAdd(["add", "my-task", "Fix", "bug"], tex);
    notifications.length = 0;

    await handleComplete(["complete", "1-my-task"], tex);

    expect(notifications).toEqual([
      {
        msg: 'Completed todo "1-my-task"\n\nNo open todos',
        level: "info",
      },
    ]);
    const data = readStore(cwd, store);
    expect(data?.entries["1-my-task"]).toBeUndefined();
  });

  it("appends the remaining todo list after a successful completion", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store, {
      confirm: async () => true,
    });

    await handleAdd(["add", "alpha", "First", "task"], tex);
    await handleAdd(["add", "beta", "Second", "task"], tex);
    notifications.length = 0;

    await handleComplete(["complete", "1-alpha"], tex);

    expect(notifications).toEqual([
      {
        msg: 'Completed todo "1-alpha"\n\n• 2-beta — Second task',
        level: "info",
      },
    ]);
  });

  it("cancels when not confirmed", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store, {
      confirm: async () => false,
    });

    await handleAdd(["add", "my-task", "Fix", "bug"], tex);
    notifications.length = 0;

    await handleComplete(["complete", "1-my-task"], tex);

    expect(notifications).toEqual([{ msg: "Cancelled", level: "info" }]);
    const data = readStore(cwd, store);
    expect(data?.entries["1-my-task"]).toBeDefined();
  });

  it("rejects missing name", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleComplete(["complete"], tex);

    expect(notifications).toEqual([{ msg: "Usage: /todo complete <name>", level: "warning" }]);
  });

  it("rejects invalid name", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleComplete(["complete", "bad name!"], tex);

    expect(notifications[0].level).toBe("error");
    expect(notifications[0].msg).toContain("Invalid name");
  });

  it("rejects non-existent todo", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleComplete(["complete", "nope"], tex);

    expect(notifications[0].level).toBe("error");
    expect(notifications[0].msg).toContain("not found");
  });
});

describe("getTodoCompletions", () => {
  const cwd = process.cwd();
  const stores: string[] = [];

  afterEach(() => {
    for (const store of stores) purgeStore(cwd, store);
    stores.length = 0;
  });

  it("returns null when store does not exist", () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const result = getTodoCompletions(cwd, store, "complete", "");
    expect(result).toBeNull();
  });

  it("returns null when store has no entries", () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    ensureStore(cwd, store);
    const result = getTodoCompletions(cwd, store, "complete", "");
    expect(result).toBeNull();
  });

  it("returns all todos when prefix is empty", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex } = makeMockTex(cwd, store);
    await handleAdd(["add", "alpha", "First", "task"], tex);
    await handleAdd(["add", "beta", "Second", "task"], tex);

    const result = getTodoCompletions(cwd, store, "complete", "");
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    const values = result!.map((r: AutocompleteItem) => r.label);
    expect(values).toContain("1-alpha");
    expect(values).toContain("2-beta");
  });

  it("filters todos by prefix", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex } = makeMockTex(cwd, store);
    await handleAdd(["add", "alpha", "First", "task"], tex);
    await handleAdd(["add", "beta", "Second", "task"], tex);

    const result = getTodoCompletions(cwd, store, "complete", "1-al");
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].label).toBe("1-alpha");
    expect(result![0].value).toBe("complete 1-alpha");
    expect(result![0].description).toBe("First task");
  });

  it("returns null when no todos match prefix", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex } = makeMockTex(cwd, store);
    await handleAdd(["add", "alpha", "First", "task"], tex);

    const result = getTodoCompletions(cwd, store, "complete", "xyz");
    expect(result).toBeNull();
  });

  it("prefixes value with the given subcommand", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex } = makeMockTex(cwd, store);
    await handleAdd(["add", "my-task", "Fix", "the", "bug"], tex);

    const result = getTodoCompletions(cwd, store, "complete", "1-my");
    expect(result).not.toBeNull();
    expect(result![0]).toEqual({
      value: "complete 1-my-task",
      label: "1-my-task",
      description: "Fix the bug",
    });
  });

  it("uses design subcommand in value when specified", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex } = makeMockTex(cwd, store);
    await handleAdd(["add", "my-task", "Fix", "the", "bug"], tex);

    const result = getTodoCompletions(cwd, store, "design", "1-my");
    expect(result).not.toBeNull();
    expect(result![0]).toEqual({
      value: "design 1-my-task",
      label: "1-my-task",
      description: "Fix the bug",
    });
  });
});


