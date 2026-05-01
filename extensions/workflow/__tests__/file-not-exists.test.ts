import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getConditionCommand } from "../commands/registry.js";
import { readKey, writeKey } from "../../memory/store.js";
import { makeStoreName, purgeStore } from "../../testutils/index.js";
import { writeFile } from "../../testutils/fixtures.js";
import type { CommandContext } from "../commands/registry.js";

import "../commands/file-not-exists.js";

const cwd = process.cwd();

function makeCommandCtx(storeName: string): CommandContext {
  return {
    cwd,
    workflowId: storeName,
    ctx: {
      ui: {},
    } as any,
  };
}

describe("file-not-exists condition command", () => {
  const stores: string[] = [];
  const pathsToClean: string[] = [];

  afterEach(() => {
    for (const store of stores) purgeStore(cwd, store);
    stores.length = 0;
    for (const rel of pathsToClean.reverse()) {
      rmSync(join(cwd, rel), { recursive: true, force: true });
    }
    pathsToClean.length = 0;
  });

  it("is registered as a condition command", () => {
    const fn = getConditionCommand("file-not-exists");
    expect(fn).toBeDefined();
  });

  it("returns true when a literal filepath does not exist", async () => {
    const store = makeStoreName("test-workflow-file-not-exists-");
    stores.push(store);
    const fn = getConditionCommand("file-not-exists")!;

    await fn(makeCommandCtx(store), { filepath: "plans/missing/design.md" });

    expect(readKey(cwd, store, "workflow-condition-result")).toBe(
      JSON.stringify({
        result: "true",
        explanation: "File does not exist: plans/missing/design.md",
      }),
    );
  });

  it("returns false when a literal filepath exists as a file", async () => {
    const store = makeStoreName("test-workflow-file-not-exists-");
    stores.push(store);
    const fn = getConditionCommand("file-not-exists")!;
    writeFile(cwd, "plans/existing/design.md", "# design\n");
    pathsToClean.push("plans/existing/design.md", "plans/existing", "plans");

    await fn(makeCommandCtx(store), { filepath: "plans/existing/design.md" });

    expect(readKey(cwd, store, "workflow-condition-result")).toBe(
      JSON.stringify({
        result: "false",
        explanation: "File exists: plans/existing/design.md",
      }),
    );
  });

  it("returns true when a literal filepath resolves to a directory", async () => {
    const store = makeStoreName("test-workflow-file-not-exists-");
    stores.push(store);
    const fn = getConditionCommand("file-not-exists")!;
    mkdirSync(join(cwd, "plans/directory-target"), { recursive: true });
    pathsToClean.push("plans/directory-target", "plans");

    await fn(makeCommandCtx(store), { filepath: "plans/directory-target" });

    expect(readKey(cwd, store, "workflow-condition-result")).toBe(
      JSON.stringify({
        result: "true",
        explanation: "Path exists but is not a file: plans/directory-target",
      }),
    );
  });

  it("returns true when the memory key is missing", async () => {
    const store = makeStoreName("test-workflow-file-not-exists-");
    stores.push(store);
    const fn = getConditionCommand("file-not-exists")!;

    await fn(makeCommandCtx(store), { memoryKey: "design-doc" });

    expect(readKey(cwd, store, "workflow-condition-result")).toBe(
      JSON.stringify({
        result: "true",
        explanation: 'Memory key "design-doc" does not exist',
      }),
    );
  });

  it("returns true when memoryKey points to a missing file", async () => {
    const store = makeStoreName("test-workflow-file-not-exists-");
    stores.push(store);
    const fn = getConditionCommand("file-not-exists")!;
    writeKey(cwd, store, "design-doc", "plans/from-memory/design.md");

    await fn(makeCommandCtx(store), { memoryKey: "design-doc" });

    expect(readKey(cwd, store, "workflow-condition-result")).toBe(
      JSON.stringify({
        result: "true",
        explanation: "File does not exist: plans/from-memory/design.md",
      }),
    );
  });

  it("returns false when memoryKey points to an existing file", async () => {
    const store = makeStoreName("test-workflow-file-not-exists-");
    stores.push(store);
    const fn = getConditionCommand("file-not-exists")!;
    writeKey(cwd, store, "design-doc", "plans/from-memory/existing.md");
    writeFile(cwd, "plans/from-memory/existing.md", "ready\n");
    pathsToClean.push(
      "plans/from-memory/existing.md",
      "plans/from-memory",
      "plans",
    );

    await fn(makeCommandCtx(store), { memoryKey: "design-doc" });

    expect(readKey(cwd, store, "workflow-condition-result")).toBe(
      JSON.stringify({
        result: "false",
        explanation: "File exists: plans/from-memory/existing.md",
      }),
    );
  });

  it("returns true when memoryKey points to a directory", async () => {
    const store = makeStoreName("test-workflow-file-not-exists-");
    stores.push(store);
    const fn = getConditionCommand("file-not-exists")!;
    writeKey(cwd, store, "design-doc", "plans/from-memory-dir");
    mkdirSync(join(cwd, "plans/from-memory-dir"), { recursive: true });
    pathsToClean.push("plans/from-memory-dir", "plans");

    await fn(makeCommandCtx(store), { memoryKey: "design-doc" });

    expect(readKey(cwd, store, "workflow-condition-result")).toBe(
      JSON.stringify({
        result: "true",
        explanation: "Path exists but is not a file: plans/from-memory-dir",
      }),
    );
  });

  it("throws when both memoryKey and filepath are provided", async () => {
    const store = makeStoreName("test-workflow-file-not-exists-");
    stores.push(store);
    const fn = getConditionCommand("file-not-exists")!;

    await expect(
      fn(makeCommandCtx(store), {
        memoryKey: "design-doc",
        filepath: "plans/design.md",
      }),
    ).rejects.toThrow(
      "file-not-exists: 'memoryKey' and 'filepath' are mutually exclusive",
    );
  });

  it("throws when neither memoryKey nor filepath is provided", async () => {
    const store = makeStoreName("test-workflow-file-not-exists-");
    stores.push(store);
    const fn = getConditionCommand("file-not-exists")!;

    await expect(fn(makeCommandCtx(store), {})).rejects.toThrow(
      "file-not-exists requires either 'memoryKey' or 'filepath' arg",
    );
  });
});
