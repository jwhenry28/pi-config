import { describe, it, expect, afterEach } from "vitest";
import { handleAdd } from "../add.js";
import { handleComplete } from "../complete.js";
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

    expect(notifications).toEqual([{ msg: 'Added todo "1-my-task"', level: "info" }]);

    const data = readStore(cwd, store);
    expect(data).not.toBeNull();
    const raw = Buffer.from(data!.entries["1-my-task"], "base64").toString("utf-8");
    const todo = JSON.parse(raw);
    expect(todo).toEqual({ name: "1-my-task", description: "Fix the bug", design: "" });
  });

  it("auto-prefixes the first unnumbered todo with 1-", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleAdd(["add", "do-stuff", "Do", "the", "thing"], tex);

    expect(notifications).toEqual([{ msg: 'Added todo "1-do-stuff"', level: "info" }]);

    const data = readStore(cwd, store);
    expect(data).not.toBeNull();
    const raw = Buffer.from(data!.entries["1-do-stuff"], "base64").toString("utf-8");
    expect(JSON.parse(raw)).toEqual({
      name: "1-do-stuff",
      description: "Do the thing",
      design: "",
    });
  });

  it("fills the lowest unused positive number for unnumbered todos", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex } = makeMockTex(cwd, store);

    await handleAdd(["add", "1-do-stuff", "Do", "stuff"], tex);
    await handleAdd(["add", "3-write-tests", "Write", "tests"], tex);
    await handleAdd(["add", "add-readme", "Add", "the", "README"], tex);

    const data = readStore(cwd, store);
    expect(data?.entries["2-add-readme"]).toBeDefined();
  });

  it("ignores completed todos when auto-allocating the next number", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex } = makeMockTex(cwd, store, {
      confirm: async () => true,
    });

    await handleAdd(["add", "do-stuff", "Do", "stuff"], tex);
    await handleAdd(["add", "write-tests", "Write", "tests"], tex);
    await handleComplete(["complete", "2-write-tests"], tex);
    await handleAdd(["add", "add-readme", "Add", "README"], tex);

    const data = readStore(cwd, store);
    expect(data?.entries["2-add-readme"]).toBeDefined();
  });

  it("preserves a manually numbered name", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleAdd(["add", "99-another-thing", "Keep", "manual", "number"], tex);

    expect(notifications).toEqual([{ msg: 'Added todo "99-another-thing"', level: "info" }]);
    const data = readStore(cwd, store);
    expect(data?.entries["99-another-thing"]).toBeDefined();
  });

  it("strips leading zeroes from manual numbered names", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleAdd(["add", "0007-task", "Normalize", "the", "prefix"], tex);

    expect(notifications).toEqual([{ msg: 'Added todo "7-task"', level: "info" }]);
    const data = readStore(cwd, store);
    expect(data?.entries["7-task"]).toBeDefined();
    expect(data?.entries["0007-task"]).toBeUndefined();
  });

  it("preserves a lone zero prefix", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleAdd(["add", "0-task", "Keep", "zero"], tex);

    expect(notifications).toEqual([{ msg: 'Added todo "0-task"', level: "info" }]);
    const data = readStore(cwd, store);
    expect(data?.entries["0-task"]).toBeDefined();
  });

  it("rejects a duplicate exact final name after normalization", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleAdd(["add", "1-task", "Original", "todo"], tex);
    await handleAdd(["add", "01-task", "Duplicate", "after", "normalization"], tex);

    expect(notifications[1]).toEqual({
      msg: 'Todo "1-task" already exists. Use /todo complete to complete it first.',
      level: "warning",
    });
  });

  it("allows duplicate manual numbers when the final names differ", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex } = makeMockTex(cwd, store);

    await handleAdd(["add", "2-add-readme", "Add", "README"], tex);
    await handleAdd(["add", "2-take-a-break", "Take", "a", "break"], tex);

    const data = readStore(cwd, store);
    expect(data?.entries["2-add-readme"]).toBeDefined();
    expect(data?.entries["2-take-a-break"]).toBeDefined();
  });

  it("keeps searching upward if an auto-generated full name already exists", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex } = makeMockTex(cwd, store);

    await handleAdd(["add", "1-do-stuff", "Manual", "first"], tex);
    await handleAdd(["add", "do-stuff", "Auto", "second"], tex);

    const data = readStore(cwd, store);
    expect(data?.entries["2-do-stuff"]).toBeDefined();
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

  it("rejects duplicate exact final name", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);

    await handleAdd(["add", "1-dup", "first", "desc"], tex);
    await handleAdd(["add", "1-dup", "second", "desc"], tex);

    expect(notifications[1].level).toBe("warning");
    expect(notifications[1].msg).toContain("already exists");
  });
});
