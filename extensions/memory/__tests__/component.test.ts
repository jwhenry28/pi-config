import { describe, it, expect, afterEach } from "vitest";
import { createComponentTest, type ComponentTestSession } from "../../testutils/component/index.js";
import { makeStoreName } from "../../testutils/index.js";
import { createStore, addEntry, clearReservedStores } from "../store.js";

const stores: string[] = [];

function freshStore(): string {
  const name = makeStoreName("test-mem-");
  stores.push(name);
  return name;
}

describe("memory slash commands (component)", () => {
  let test: ComponentTestSession | undefined;

  afterEach(() => {
    // dispose() cleans up the temp dir, so no manual store purge needed
    test?.dispose();
    test = undefined;
    stores.length = 0;
    clearReservedStores();
  });

  // ── help ───────────────────────────────────────────────────────

  it("/memory help shows usage", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/memory help");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("Usage") })
    );
  });

  it("/memory with no args shows help", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/memory");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("Usage") })
    );
  });

  // ── create ─────────────────────────────────────────────────────

  it("/memory create creates a store", async () => {
    test = await createComponentTest();
    const name = freshStore();
    test.sendUserMessage(`/memory create ${name}`);

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("Created") })
    );
  });

  it("/memory create duplicate shows error", async () => {
    test = await createComponentTest();
    const name = freshStore();
    test.sendUserMessage(`/memory create ${name}`);
    test.sendUserMessage(`/memory create ${name}`);

    const errors = test.notifications.filter((n) => n.message.includes("already exists"));
    expect(errors).toHaveLength(1);
  });

  // ── set ────────────────────────────────────────────────────────

  it("/memory set adds a value", async () => {
    test = await createComponentTest();
    const name = freshStore();
    createStore(test!.cwd, name);
    test.sendUserMessage(`/memory set ${name} key1 hello world`);

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("Added") })
    );
  });

  it("/memory set with missing args shows usage", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/memory set");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("Usage"), type: "warning" })
    );
  });

  // ── get ────────────────────────────────────────────────────────

  it("/memory get retrieves a value", async () => {
    test = await createComponentTest();
    const name = freshStore();
    createStore(test!.cwd, name);
    addEntry(test!.cwd, name, "key1", "hello world");
    test.sendUserMessage(`/memory get ${name} key1`);

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: "hello world" })
    );
  });

  it("/memory get missing key shows error", async () => {
    test = await createComponentTest();
    const name = freshStore();
    createStore(test!.cwd, name);
    test.sendUserMessage(`/memory get ${name} missing`);

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("not found"), type: "error" })
    );
  });

  // ── list ───────────────────────────────────────────────────────

  it("/memory list shows store names", async () => {
    test = await createComponentTest();
    const name = freshStore();
    createStore(test!.cwd, name);
    test.sendUserMessage("/memory list");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining(name) })
    );
  });

  it("/memory list <store> shows keys", async () => {
    test = await createComponentTest();
    const name = freshStore();
    createStore(test!.cwd, name);
    addEntry(test!.cwd, name, "alpha", "1");
    addEntry(test!.cwd, name, "beta", "2");
    test.sendUserMessage(`/memory list ${name}`);

    const notif = test.notifications.find((n) => n.message.includes("alpha"));
    expect(notif).toBeDefined();
    expect(notif!.message).toContain("beta");
  });

  // ── delete ─────────────────────────────────────────────────────

  it("/memory delete removes a key", async () => {
    test = await createComponentTest();
    const name = freshStore();
    createStore(test!.cwd, name);
    addEntry(test!.cwd, name, "k", "v");
    test.sendUserMessage(`/memory delete ${name} k`);

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("Deleted") })
    );
  });

  it("/memory delete missing key shows error", async () => {
    test = await createComponentTest();
    const name = freshStore();
    createStore(test!.cwd, name);
    test.sendUserMessage(`/memory delete ${name} missing`);

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("not found"), type: "error" })
    );
  });

  // ── stats ──────────────────────────────────────────────────────

  it("/memory stats shows metadata", async () => {
    test = await createComponentTest();
    const name = freshStore();
    createStore(test!.cwd, name);
    addEntry(test!.cwd, name, "k", "v");
    test.sendUserMessage(`/memory stats ${name}`);

    const notif = test.notifications.find((n) => n.message.includes("Keys: 1"));
    expect(notif).toBeDefined();
    expect(notif!.message).toContain("Created:");
    expect(notif!.message).toContain("Size:");
  });

  // ── purge ──────────────────────────────────────────────────────

  it("/memory purge cancelled shows Cancelled", async () => {
    test = await createComponentTest();
    const name = freshStore();
    createStore(test!.cwd, name);
    // confirm defaults to false in component test
    test.sendUserMessage(`/memory purge ${name}`);
    await test.waitForIdle();

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: "Cancelled" })
    );
  });

  it("/memory purge all cancelled shows Cancelled", async () => {
    test = await createComponentTest();
    const name = freshStore();
    createStore(test!.cwd, name);
    test.sendUserMessage("/memory purge all");
    await test.waitForIdle();

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: "Cancelled" })
    );
  });

  // ── unknown subcommand ─────────────────────────────────────────

  it("/memory unknown shows warning", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/memory foobar");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("Unknown subcommand"), type: "warning" })
    );
  });
});

// ── Agent Tool Tests ───────────────────────────────────────────────

describe("memory tools (component)", () => {
  let test: ComponentTestSession | undefined;

  afterEach(() => {
    test?.dispose();
    test = undefined;
    stores.length = 0;
    clearReservedStores();
  });

  it("memory_create tool creates a store", async () => {
    test = await createComponentTest({ shownModules: ["memory"] });
    const name = freshStore();

    const result = await test.invokeTool("memory_create", { store: name });

    expect(result.toolName).toBe("memory_create");
    expect(result.isError).toBe(false);
    expect(JSON.stringify(result.result)).toContain("Created");
    expect(test.events.toolCalls()[0]).toEqual({
      toolName: "memory_create",
      args: { store: name },
    });
  });

  it("memory_add tool adds a key", async () => {
    test = await createComponentTest({ shownModules: ["memory"] });
    const name = freshStore();
    createStore(test!.cwd, name);

    const result = await test.invokeTool("memory_add", { store: name, key: "k1", value: "hello" });

    expect(result.isError).toBe(false);
    expect(JSON.stringify(result.result)).toContain("Added");
  });

  it("memory_get tool retrieves a value", async () => {
    test = await createComponentTest({ shownModules: ["memory"] });
    const name = freshStore();
    createStore(test!.cwd, name);
    addEntry(test!.cwd, name, "k1", "secret");

    const result = await test.invokeTool("memory_get", { store: name, key: "k1" });

    expect(result.isError).toBe(false);
    expect(JSON.stringify(result.result)).toContain("secret");
  });

  it("memory_list tool lists stores when no store arg", async () => {
    test = await createComponentTest({ shownModules: ["memory"] });
    const name = freshStore();
    createStore(test!.cwd, name);

    const result = await test.invokeTool("memory_list", {});

    expect(result.isError).toBe(false);
    expect(JSON.stringify(result.result)).toContain(name);
  });

  it("memory_list tool lists keys when store specified", async () => {
    test = await createComponentTest({ shownModules: ["memory"] });
    const name = freshStore();
    createStore(test!.cwd, name);
    addEntry(test!.cwd, name, "alpha", "1");

    const result = await test.invokeTool("memory_list", { store: name });

    expect(result.isError).toBe(false);
    expect(JSON.stringify(result.result)).toContain("alpha");
  });

  it("memory_delete tool deletes a key", async () => {
    test = await createComponentTest({ shownModules: ["memory"] });
    const name = freshStore();
    createStore(test!.cwd, name);
    addEntry(test!.cwd, name, "k1", "v");

    const result = await test.invokeTool("memory_delete", { store: name, key: "k1" });

    expect(result.isError).toBe(false);
    expect(JSON.stringify(result.result)).toContain("Deleted");
  });

  it("memory_create tool returns error for duplicate", async () => {
    test = await createComponentTest({ shownModules: ["memory"] });
    const name = freshStore();
    createStore(test!.cwd, name);

    const result = await test.invokeTool("memory_create", { store: name });

    expect(JSON.stringify(result.result)).toContain("already exists");
  });

  it("memory_get tool returns error for missing key", async () => {
    test = await createComponentTest({ shownModules: ["memory"] });
    const name = freshStore();
    createStore(test!.cwd, name);

    const result = await test.invokeTool("memory_get", { store: name, key: "nope" });

    expect(JSON.stringify(result.result)).toContain("not found");
  });

  it("memory_add tool returns error for missing store", async () => {
    test = await createComponentTest({ shownModules: ["memory"] });

    const result = await test.invokeTool("memory_add", { store: "nonexistent", key: "k", value: "v" });

    expect(JSON.stringify(result.result)).toContain("does not exist");
  });

});
