import { describe, it, expect, afterEach } from "vitest";
import { applyConfigFile, unapplyConfigFile } from "../apply.js";
import { readKey } from "../../memory/store.js";
import { makeStoreName, purgeStore } from "../../testutils/index.js";
import type { ConfigExecutionContext, ConfigFile } from "../types.js";

const cwd = process.cwd();

describe("applyConfigFile", () => {
  const stores: string[] = [];

  afterEach(() => {
    for (const store of stores) purgeStore(cwd, store);
    stores.length = 0;
  });

  function makeCtx(overrides?: Partial<ConfigExecutionContext>): ConfigExecutionContext {
    const store = makeStoreName("test-config-");
    stores.push(store);
    return {
      cwd,
      storeName: store,
      ui: { notify: () => {} },
      modelRegistry: {
        getAll: () => [
          { id: "claude-opus-4-6" },
          { id: "claude-sonnet-4-6" },
          { id: "claude-haiku-4-5" },
        ],
      },
      ...overrides,
    };
  }

  it("writes all config entries to the store", () => {
    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "full",
      configs: [
        { name: "smart", value: "claude-opus-4-6" },
        { name: "general", value: "claude-sonnet-4-6" },
        { name: "fast", value: "claude-haiku-4-5" },
      ],
    };
    const result = applyConfigFile(file, ctx);
    expect(result.updatedKeys).toEqual(["smart", "general", "fast"]);
    expect(result.warnings).toEqual([]);

    expect(readKey(cwd, ctx.storeName, "smart")).toBe("claude-opus-4-6");
    expect(readKey(cwd, ctx.storeName, "general")).toBe("claude-sonnet-4-6");
    expect(readKey(cwd, ctx.storeName, "fast")).toBe("claude-haiku-4-5");
  });

  it("writes active-config key", () => {
    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "Test Config",
      configs: [{ name: "smart", value: "claude-opus-4-6" }],
    };
    applyConfigFile(file, ctx);
    expect(readKey(cwd, ctx.storeName, "active-config")).toBe("Test Config");
  });

  it("warns on unknown config key and skips it", () => {
    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "unknown",
      configs: [
        { name: "smart", value: "claude-opus-4-6" },
        { name: "nonexistent", value: "whatever" },
      ],
    };
    const result = applyConfigFile(file, ctx);
    expect(result.updatedKeys).toEqual(["smart"]);
    expect(result.warnings).toContainEqual(expect.stringContaining("Unknown config key: nonexistent"));
    expect(readKey(cwd, ctx.storeName, "nonexistent")).toBeNull();
  });

  it("throws when validator rejects a value", () => {
    const ctx = makeCtx({
      modelRegistry: { getAll: () => [] },
    });
    const file: ConfigFile = {
      name: "bad",
      configs: [{ name: "smart", value: "nonexistent-model" }],
    };
    expect(() => applyConfigFile(file, ctx)).toThrow("Model not found in registry");
  });

  it("accepts provider-qualified model via registry.find", () => {
    const ctx = makeCtx({
      modelRegistry: {
        getAll: () => [],
        find: (provider: string, id: string) =>
          provider === "anthropic" && id === "claude-opus-4-6" ? { id: "claude-opus-4-6" } : undefined,
      },
    });
    const file: ConfigFile = {
      name: "qualified",
      configs: [{ name: "smart", value: "anthropic/claude-opus-4-6" }],
    };
    const result = applyConfigFile(file, ctx);
    expect(result.updatedKeys).toEqual(["smart"]);
  });
});

describe("unapplyConfigFile", () => {
  const stores: string[] = [];

  afterEach(() => {
    for (const store of stores) purgeStore(cwd, store);
    stores.length = 0;
  });

  function makeCtx(overrides?: Partial<ConfigExecutionContext>): ConfigExecutionContext {
    const store = makeStoreName("test-config-");
    stores.push(store);
    return {
      cwd,
      storeName: store,
      ui: { notify: () => {} },
      modelRegistry: {
        getAll: () => [
          { id: "claude-opus-4-6" },
          { id: "claude-sonnet-4-6" },
          { id: "claude-haiku-4-5" },
        ],
      },
      ...overrides,
    };
  }

  it("removes config keys from store", () => {
    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "to-unapply",
      configs: [{ name: "smart", value: "claude-opus-4-6" }],
    };
    applyConfigFile(file, ctx);
    expect(readKey(cwd, ctx.storeName, "smart")).toBe("claude-opus-4-6");

    const result = unapplyConfigFile(file, ctx);
    expect(readKey(cwd, ctx.storeName, "smart")).toBeNull();
    expect(readKey(cwd, ctx.storeName, "active-config")).toBeNull();
    expect(result.updatedKeys).toEqual(["smart"]);
  });
});
