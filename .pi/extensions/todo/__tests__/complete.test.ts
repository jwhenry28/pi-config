import { describe, it, expect, afterEach } from "vitest";
import { handleAdd } from "../add.js";
import { handleComplete } from "../complete.js";
import { readStore } from "../../memory/store.js";
import { makeStoreName, makeMockTex, purgeStore } from "../../testutils/index.js";

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

    await handleComplete(["complete", "my-task"], tex);

    expect(notifications).toEqual([{ msg: 'Completed todo "my-task"', level: "info" }]);
    const data = readStore(cwd, store);
    expect(data?.entries["my-task"]).toBeUndefined();
  });

  it("cancels when not confirmed", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store, {
      confirm: async () => false,
    });

    await handleAdd(["add", "my-task", "Fix", "bug"], tex);
    notifications.length = 0;

    await handleComplete(["complete", "my-task"], tex);

    expect(notifications).toEqual([{ msg: "Cancelled", level: "info" }]);
    const data = readStore(cwd, store);
    expect(data?.entries["my-task"]).toBeDefined();
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
