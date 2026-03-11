import { describe, it, expect, afterEach } from "vitest";
import { existsSync, unlinkSync, rmdirSync } from "node:fs";
import { handleAdd } from "../add.js";
import { handleDesign } from "../design.js";
import { readStore } from "../../memory/store.js";
import {
  makeStoreName,
  makeMockTex,
  makeMockPi,
  purgeStore,
} from "../../testutils/index.js";

describe("handleDesign", () => {
  const cwd = process.cwd();
  const stores: string[] = [];
  const filesToClean: string[] = [];

  afterEach(() => {
    for (const store of stores) purgeStore(cwd, store);
    stores.length = 0;
    for (const f of filesToClean) {
      if (existsSync(f)) unlinkSync(f);
    }
    filesToClean.length = 0;
    // Clean up the todos directory if empty
    try { rmdirSync("./todos"); } catch { /* ignore */ }
  });

  const fakeSkillPath = __filename; // any readable file works
  const fakeSkills = [{ name: "brainstorming", filePath: fakeSkillPath }] as any;

  it("rejects missing name", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);
    const { pi } = makeMockPi();

    await handleDesign(["design"], tex, pi, fakeSkills);

    expect(notifications).toEqual([{ msg: "Usage: /todo design <name>", level: "warning" }]);
  });

  it("rejects invalid name", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);
    const { pi } = makeMockPi();

    await handleDesign(["design", "bad name!"], tex, pi, fakeSkills);

    expect(notifications[0].level).toBe("error");
    expect(notifications[0].msg).toContain("Invalid name");
  });

  it("rejects non-existent todo", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);
    const { pi } = makeMockPi();

    await handleDesign(["design", "nope"], tex, pi, fakeSkills);

    expect(notifications[0].level).toBe("error");
    expect(notifications[0].msg).toContain("not found");
  });

  it("notifies when brainstorming skill is missing", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);
    const { pi } = makeMockPi();

    await handleAdd(["add", "my-task", "Some", "description"], tex);
    notifications.length = 0;
    filesToClean.push("./todos/my-task.md");

    await handleDesign(["design", "my-task"], tex, pi, []);

    expect(notifications).toEqual([
      { msg: "Brainstorming skill not found. Cannot generate design.", level: "error" },
    ]);
  });

  it("creates design file and sends messages on success", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex, notifications } = makeMockTex(cwd, store);
    const { pi, messages } = makeMockPi();

    await handleAdd(["add", "my-task", "Fix", "the", "bug"], tex);
    notifications.length = 0;
    filesToClean.push("./todos/my-task.md");

    await handleDesign(["design", "my-task"], tex, pi, fakeSkills);

    // No error notifications
    expect(notifications).toEqual([]);

    // Design file was created
    expect(existsSync("./todos/my-task.md")).toBe(true);

    // Store was updated with design path
    const data = readStore(cwd, store);
    const raw = Buffer.from(data!.entries["my-task"], "base64").toString("utf-8");
    const todo = JSON.parse(raw);
    expect(todo.design).toBe("./todos/my-task.md");

    // Skill was injected via sendMessage
    expect(messages.sent.length).toBe(1);
    expect(messages.sent[0].customType).toBe("todo:skill");
    expect((messages.sent[0].content as string)).toContain("brainstorming");

    // User message was sent via sendUserMessage
    expect(messages.userMessages.length).toBe(1);
    expect(messages.userMessages[0]).toContain("my-task");
    expect(messages.userMessages[0]).toContain("Fix the bug");
    expect(messages.userMessages[0]).toContain("todos/my-task.md");
  });

  it("asks to overwrite existing design and aborts on decline", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex: addTex } = makeMockTex(cwd, store);
    const { pi, messages } = makeMockPi();

    await handleAdd(["add", "my-task", "Fix", "bug"], addTex);
    filesToClean.push("./todos/my-task.md");

    // First design succeeds
    await handleDesign(["design", "my-task"], addTex, pi, fakeSkills);
    messages.sent.length = 0;
    messages.userMessages.length = 0;

    // Second design with confirm = false (decline overwrite)
    const { tex: declineTex, notifications } = makeMockTex(cwd, store, {
      confirm: async () => false,
    });

    await handleDesign(["design", "my-task"], declineTex, pi, fakeSkills);

    // Should have returned early — no new messages sent
    expect(messages.sent).toEqual([]);
    expect(messages.userMessages).toEqual([]);
    expect(notifications).toEqual([]);
  });

  it("overwrites existing design when confirmed", async () => {
    const store = makeStoreName("test-todo-");
    stores.push(store);
    const { tex: addTex } = makeMockTex(cwd, store);
    const { pi, messages } = makeMockPi();

    await handleAdd(["add", "my-task", "Fix", "bug"], addTex);
    filesToClean.push("./todos/my-task.md");

    // First design
    await handleDesign(["design", "my-task"], addTex, pi, fakeSkills);
    messages.sent.length = 0;
    messages.userMessages.length = 0;

    // Second design with confirm = true
    const { tex: confirmTex, notifications } = makeMockTex(cwd, store, {
      confirm: async () => true,
    });

    await handleDesign(["design", "my-task"], confirmTex, pi, fakeSkills);

    expect(notifications).toEqual([]);
    expect(messages.sent.length).toBe(1);
    expect(messages.userMessages.length).toBe(1);
  });
});
