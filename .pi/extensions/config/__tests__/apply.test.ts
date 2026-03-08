import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { applyConfigFile, unapplyConfigFile } from "../apply.js";
import { readKey } from "../../memory/store.js";
import { makeStoreName, purgeStore } from "../../testutils/index.js";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setHomeDirOverride, clearHomeDirOverride } from "../../shared/home.js";
import { WRAPPER_SKILLS_DIR, WORKFLOWS_DIR } from "../../shared/paths.js";
import type { ConfigExecutionContext, ConfigFile } from "../types.js";

const cwd = process.cwd();

function createFakePluginSkill(baseDir: string, location: string): void {
  const skillDir = join(baseDir, ".pi", "plugins", location);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), "---\nname: test\n---\n# Test");
}

function createFakePluginWorkflow(baseDir: string, location: string): void {
  const parts = location.split("/");
  const dir = join(baseDir, ".pi", "plugins", ...parts.slice(0, -1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(baseDir, ".pi", "plugins", location), "name: test-workflow\nsteps: []");
}

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

describe("applyConfigFile — skills and workflows", () => {
  const stores: string[] = [];
  let tempDir: string;
  let tempCwd: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `test-config-apply-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempCwd = join(tempDir, "project");
    mkdirSync(tempCwd, { recursive: true });
    setHomeDirOverride(tempDir);
  });

  afterEach(() => {
    clearHomeDirOverride();
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    for (const store of stores) purgeStore(tempCwd, store);
    stores.length = 0;
  });

  function makeCtx(overrides?: Partial<ConfigExecutionContext>): ConfigExecutionContext {
    const store = makeStoreName("test-config-");
    stores.push(store);
    return {
      cwd: tempCwd,
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

  // Skills tests
  it("creates wrapper for valid skill", () => {
    createFakePluginSkill(tempDir, "my-repo/skills/foo");
    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "with-skills",
      skills: [{ location: "my-repo/skills/foo", module: "development" }],
    };
    const result = applyConfigFile(file, ctx);
    expect(result.skills).toEqual(["foo"]);
    expect(result.warnings).toEqual([]);
    expect(existsSync(join(tempCwd, WRAPPER_SKILLS_DIR, "foo", "WRAPPER.md"))).toBe(true);
  });

  it("warns when skill target path is invalid", () => {
    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "bad-skill",
      skills: [{ location: "nonexistent/skills/bar" }],
    };
    const result = applyConfigFile(file, ctx);
    expect(result.skills).toEqual([]);
    expect(result.warnings[0]).toContain("bar");
  });

  it("warns when wrapper already exists", () => {
    createFakePluginSkill(tempDir, "my-repo/skills/foo");
    const wrapperDir = join(tempCwd, WRAPPER_SKILLS_DIR, "foo");
    mkdirSync(wrapperDir, { recursive: true });
    writeFileSync(join(wrapperDir, "WRAPPER.md"), "existing");

    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "dup-skill",
      skills: [{ location: "my-repo/skills/foo" }],
    };
    const result = applyConfigFile(file, ctx);
    expect(result.skills).toEqual([]);
    expect(result.warnings[0]).toContain("already exists");
  });

  // Workflows tests
  it("copies workflow file to workflows dir", () => {
    createFakePluginWorkflow(tempDir, "my-repo/workflows/deploy.yml");
    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "with-workflow",
      workflows: [{ location: "my-repo/workflows/deploy.yml" }],
    };
    const result = applyConfigFile(file, ctx);
    expect(result.workflows).toEqual(["deploy.yml"]);
    expect(existsSync(join(tempCwd, WORKFLOWS_DIR, "deploy.yml"))).toBe(true);
  });

  it("warns when source workflow does not exist", () => {
    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "missing-wf",
      workflows: [{ location: "nonexistent/workflows/missing.yml" }],
    };
    const result = applyConfigFile(file, ctx);
    expect(result.workflows).toEqual([]);
    expect(result.warnings[0]).toContain("missing.yml");
  });

  it("warns when workflow already exists at destination", () => {
    createFakePluginWorkflow(tempDir, "my-repo/workflows/deploy.yml");
    mkdirSync(join(tempCwd, WORKFLOWS_DIR), { recursive: true });
    writeFileSync(join(tempCwd, WORKFLOWS_DIR, "deploy.yml"), "existing");

    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "dup-wf",
      workflows: [{ location: "my-repo/workflows/deploy.yml" }],
    };
    const result = applyConfigFile(file, ctx);
    expect(result.workflows).toEqual([]);
    expect(result.warnings[0]).toContain("already exists");
  });

  // needsReload tests
  it("needsReload is false when only configs applied", () => {
    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "configs-only",
      configs: [{ name: "smart", value: "claude-opus-4-6" }],
    };
    const result = applyConfigFile(file, ctx);
    expect(result.needsReload).toBe(false);
  });

  it("needsReload is true when skills added", () => {
    createFakePluginSkill(tempDir, "my-repo/skills/foo");
    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "with-skills",
      skills: [{ location: "my-repo/skills/foo" }],
    };
    const result = applyConfigFile(file, ctx);
    expect(result.needsReload).toBe(true);
  });
});

describe("unapplyConfigFile", () => {
  const stores: string[] = [];
  let tempDir: string;
  let tempCwd: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `test-config-unapply-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempCwd = join(tempDir, "project");
    mkdirSync(tempCwd, { recursive: true });
    setHomeDirOverride(tempDir);
  });

  afterEach(() => {
    clearHomeDirOverride();
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    for (const store of stores) purgeStore(tempCwd, store);
    stores.length = 0;
  });

  function makeCtx(overrides?: Partial<ConfigExecutionContext>): ConfigExecutionContext {
    const store = makeStoreName("test-config-");
    stores.push(store);
    return {
      cwd: tempCwd,
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
    expect(readKey(tempCwd, ctx.storeName, "smart")).toBe("claude-opus-4-6");

    const result = unapplyConfigFile(file, ctx);
    expect(readKey(tempCwd, ctx.storeName, "smart")).toBeNull();
    expect(readKey(tempCwd, ctx.storeName, "active-config")).toBeNull();
    expect(result.updatedKeys).toEqual(["smart"]);
  });

  it("removes skill wrappers", () => {
    createFakePluginSkill(tempDir, "my-repo/skills/foo");
    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "to-unapply",
      skills: [{ location: "my-repo/skills/foo" }],
    };
    applyConfigFile(file, ctx);
    expect(existsSync(join(tempCwd, WRAPPER_SKILLS_DIR, "foo", "WRAPPER.md"))).toBe(true);

    const result = unapplyConfigFile(file, ctx);
    expect(result.skills).toEqual(["foo"]);
    expect(existsSync(join(tempCwd, WRAPPER_SKILLS_DIR, "foo", "WRAPPER.md"))).toBe(false);
    expect(result.needsReload).toBe(true);
  });

  it("removes copied workflows", () => {
    createFakePluginWorkflow(tempDir, "my-repo/workflows/deploy.yml");
    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "to-unapply",
      workflows: [{ location: "my-repo/workflows/deploy.yml" }],
    };
    applyConfigFile(file, ctx);
    expect(existsSync(join(tempCwd, WORKFLOWS_DIR, "deploy.yml"))).toBe(true);

    const result = unapplyConfigFile(file, ctx);
    expect(result.workflows).toEqual(["deploy.yml"]);
    expect(existsSync(join(tempCwd, WORKFLOWS_DIR, "deploy.yml"))).toBe(false);
    expect(result.needsReload).toBe(true);
  });

  it("warns when skill wrapper not found during unapply", () => {
    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "missing",
      skills: [{ location: "my-repo/skills/nonexistent" }],
    };
    const result = unapplyConfigFile(file, ctx);
    expect(result.skills).toEqual([]);
    expect(result.warnings[0]).toContain("nonexistent");
  });

  it("warns when workflow not found during unapply", () => {
    const ctx = makeCtx();
    const file: ConfigFile = {
      name: "missing",
      workflows: [{ location: "my-repo/workflows/missing.yml" }],
    };
    const result = unapplyConfigFile(file, ctx);
    expect(result.workflows).toEqual([]);
    expect(result.warnings[0]).toContain("missing.yml");
  });
});
