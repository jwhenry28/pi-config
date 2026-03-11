import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setHomeDirOverride, clearHomeDirOverride } from "../../shared/home.js";
import { writeFile, writePrompt } from "../../testutils/fixtures.js";
import { resolvePromptRef } from "../prompt-resolve.js";

describe("resolvePromptRef", () => {
  let tmpDir: string;
  let tmpHome: string;

  afterEach(() => {
    clearHomeDirOverride();
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
    if (tmpHome) rmSync(tmpHome, { recursive: true, force: true });
  });

  function setup() {
    tmpDir = mkdtempSync(join(tmpdir(), "prompt-resolve-test-"));
    tmpHome = mkdtempSync(join(tmpdir(), "prompt-home-test-"));
    setHomeDirOverride(tmpHome);
    return tmpDir;
  }

  it("resolves local prompt (no slash) to .pi/prompts/<name>.md", () => {
    const cwd = setup();
    writePrompt(cwd, "my-prompt", "PROMPT_CONTENT");
    const path = resolvePromptRef("my-prompt", cwd);
    expect(path).toBe(join(cwd, ".pi", "prompts", "my-prompt.md"));
  });

  it("auto-appends .md to local prompt", () => {
    const cwd = setup();
    writePrompt(cwd, "test", "CONTENT");
    const path = resolvePromptRef("test", cwd);
    expect(path).toBe(join(cwd, ".pi", "prompts", "test.md"));
  });

  it("does not double-append .md", () => {
    const cwd = setup();
    writePrompt(cwd, "test", "CONTENT");
    const path = resolvePromptRef("test.md", cwd);
    expect(path).toBe(join(cwd, ".pi", "prompts", "test.md"));
  });

  it("resolves plugin prompt (has slash) to ~/.pi/plugins/<path>.md", () => {
    const cwd = setup();
    writeFile(tmpHome, ".pi/plugins/my-repo/prompts/my-prompt.md", "PLUGIN_PROMPT");
    const path = resolvePromptRef("my-repo/prompts/my-prompt", cwd);
    expect(path).toBe(join(tmpHome, ".pi", "plugins", "my-repo", "prompts", "my-prompt.md"));
  });

  it("does not double-append .md for plugin prompt", () => {
    const cwd = setup();
    writeFile(tmpHome, ".pi/plugins/my-repo/prompts/my-prompt.md", "CONTENT");
    const path = resolvePromptRef("my-repo/prompts/my-prompt.md", cwd);
    expect(path).toBe(join(tmpHome, ".pi", "plugins", "my-repo", "prompts", "my-prompt.md"));
  });

  it("resolves nested local prompt directory ref", () => {
    const cwd = setup();
    writePrompt(cwd, "pack/task", "PACK_TASK");
    const path = resolvePromptRef("pack/task", cwd);
    expect(path).toBe(join(cwd, ".pi", "prompts", "pack", "task.md"));
  });

  it("falls back to home prompt directory when local prompt is missing", () => {
    const cwd = setup();
    writePrompt(tmpHome, "pack/task", "HOME_PACK_TASK");
    const path = resolvePromptRef("pack/task", cwd);
    expect(path).toBe(join(tmpHome, ".pi", "prompts", "pack", "task.md"));
  });

  it("keeps known plugin head routing behavior", () => {
    const cwd = setup();
    writeFile(tmpHome, ".pi/plugins/my-repo/prompts/my-prompt.md", "PLUGIN_PROMPT");
    const path = resolvePromptRef("my-repo/prompts/my-prompt", cwd);
    expect(path).toBe(join(tmpHome, ".pi", "plugins", "my-repo", "prompts", "my-prompt.md"));
  });

  it("throws helpful error for bare directory refs", () => {
    const cwd = setup();
    writeFile(cwd, ".pi/prompts/pack/.keep", "");

    expect(() => resolvePromptRef("pack", cwd)).toThrow(/directory/i);
    expect(() => resolvePromptRef("pack", cwd)).toThrow(/pack\/<file>/i);
  });

  it("throws ambiguity error when local and home prompt files both match", () => {
    const cwd = setup();
    writePrompt(cwd, "pack/task", "LOCAL_PACK_TASK");
    writePrompt(tmpHome, "pack/task", "HOME_PACK_TASK");

    expect(() => resolvePromptRef("pack/task", cwd)).toThrow(/ambiguous/i);
    expect(() => resolvePromptRef("pack/task", cwd)).toThrow(/\.pi\/prompts\/pack\/task\.md/i);
  });

  it("falls back to plugin path when no local/home prompt candidates exist", () => {
    const cwd = setup();
    writeFile(tmpHome, ".pi/plugins/legacy-repo/prompts/legacy.md", "LEGACY_PROMPT");

    const path = resolvePromptRef("legacy-repo/prompts/legacy", cwd);
    expect(path).toBe(join(tmpHome, ".pi", "plugins", "legacy-repo", "prompts", "legacy.md"));
  });
});
