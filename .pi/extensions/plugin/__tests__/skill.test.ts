import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { handleSkillAdd, handleSkillRemove, handleSkillTag } from "../skill.js";
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeFile, writeWrapper, writeSkill } from "../../testutils/fixtures.js";
import { WRAPPER_SKILLS_DIR } from "../../shared/paths.js";
import { setHomeDirOverride, clearHomeDirOverride, getPluginsDir } from "../../shared/home.js";
import { tmpdir } from "node:os";

const tmpHome = join(tmpdir(), `pi-test-skill-${process.pid}`);

describe("handleSkillAdd", () => {
  const cwd = process.cwd();
  const notify = vi.fn();
  const ui = { notify, confirm: vi.fn(), setStatus: vi.fn() };
  const dirsToClean: string[] = [];

  beforeEach(() => {
    setHomeDirOverride(tmpHome);
  });

  afterEach(() => {
    clearHomeDirOverride();
    for (const d of dirsToClean) {
      if (existsSync(d)) rmSync(d, { recursive: true });
    }
    dirsToClean.length = 0;
    vi.restoreAllMocks();
  });

  it("errors on missing path argument", async () => {
    await handleSkillAdd(["skill", "add"], { cwd, ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Usage"), "warning");
  });

  it("creates WRAPPER.md for valid skill path", async () => {
    const pluginsDir = getPluginsDir();
    mkdirSync(join(pluginsDir, "test-tmp-repo/skill-target"), { recursive: true });
    writeFileSync(join(pluginsDir, "test-tmp-repo/skill-target/SKILL.md"), "# Test Skill");
    dirsToClean.push(join(pluginsDir, "test-tmp-repo"));

    const skillName = "skill-target";
    const wrapperDir = join(cwd, WRAPPER_SKILLS_DIR, skillName);
    dirsToClean.push(wrapperDir);

    await handleSkillAdd(["skill", "add", "test-tmp-repo/skill-target"], { cwd, ui });

    expect(existsSync(join(wrapperDir, "WRAPPER.md"))).toBe(true);
    const content = readFileSync(join(wrapperDir, "WRAPPER.md"), "utf-8");
    expect(content).toContain("symlink: 'test-tmp-repo/skill-target'");
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Added"), "info");
  });

  it("includes module when specified", async () => {
    const pluginsDir = getPluginsDir();
    mkdirSync(join(pluginsDir, "test-tmp-repo2/skill-mod"), { recursive: true });
    writeFileSync(join(pluginsDir, "test-tmp-repo2/skill-mod/SKILL.md"), "# Test");
    dirsToClean.push(join(pluginsDir, "test-tmp-repo2"));

    const skillName = "skill-mod";
    const wrapperDir = join(cwd, WRAPPER_SKILLS_DIR, skillName);
    dirsToClean.push(wrapperDir);

    await handleSkillAdd(["skill", "add", "test-tmp-repo2/skill-mod", "mymodule"], { cwd, ui });

    const content = readFileSync(join(wrapperDir, "WRAPPER.md"), "utf-8");
    expect(content).toContain("module: mymodule");
  });

  it("errors if target has no SKILL.md", async () => {
    const pluginsDir = getPluginsDir();
    mkdirSync(join(pluginsDir, "test-tmp-repo3", "no-skill"), { recursive: true });
    dirsToClean.push(join(pluginsDir, "test-tmp-repo3"));

    await handleSkillAdd(["skill", "add", "test-tmp-repo3/no-skill"], { cwd, ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("SKILL.md"), "error");
  });
});

describe("handleSkillRemove", () => {
  const cwd = process.cwd();
  const notify = vi.fn();
  const ui = { notify, confirm: vi.fn(), setStatus: vi.fn() };
  const dirsToClean: string[] = [];

  afterEach(() => {
    for (const d of dirsToClean) {
      if (existsSync(d)) rmSync(d, { recursive: true });
    }
    dirsToClean.length = 0;
    vi.restoreAllMocks();
  });

  it("errors on missing name argument", async () => {
    await handleSkillRemove(["skill", "remove"], { cwd, ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Usage"), "warning");
  });

  it("removes WRAPPER.md and empty dir", async () => {
    const skillName = "test-remove-target";
    const skillDir = join(cwd, WRAPPER_SKILLS_DIR, skillName);
    dirsToClean.push(skillDir);

    writeWrapper(cwd, skillName, "@/foo");

    await handleSkillRemove(["skill", "remove", skillName], { cwd, ui });

    expect(existsSync(skillDir)).toBe(false);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Removed"), "info");
  });

  it("errors if no WRAPPER.md exists", async () => {
    await handleSkillRemove(["skill", "remove", "nonexistent-skill"], { cwd, ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("No WRAPPER.md"), "error");
  });
});

describe("handleSkillTag", () => {
  const cwd = process.cwd();
  const notify = vi.fn();
  const ui = { notify, confirm: vi.fn(), setStatus: vi.fn() };
  const dirsToClean: string[] = [];

  afterEach(() => {
    for (const d of dirsToClean) {
      if (existsSync(d)) rmSync(d, { recursive: true });
    }
    dirsToClean.length = 0;
    vi.restoreAllMocks();
  });

  it("errors on missing skill name", async () => {
    await handleSkillTag(["skill", "tag"], { cwd, ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Usage"), "warning");
  });

  it("errors on missing module argument", async () => {
    await handleSkillTag(["skill", "tag", "my-skill"], { cwd, ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Usage"), "warning");
  });

  it("sets module on existing WRAPPER.md", async () => {
    const wrapperSkillDir = join(cwd, WRAPPER_SKILLS_DIR, "tag-test-wrapper");
    dirsToClean.push(wrapperSkillDir);

    writeWrapper(cwd, "tag-test-wrapper", "@/repo/my-skill");

    await handleSkillTag(["skill", "tag", "tag-test-wrapper", "my-module"], { cwd, ui });

    const content = readFileSync(join(wrapperSkillDir, "WRAPPER.md"), "utf-8");
    expect(content).toContain("module: my-module");
    expect(content).toContain("symlink: '@/repo/my-skill'");
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Tagged"), "info");
  });

  it("sets module on existing SKILL.md", async () => {
    const skillDir = join(cwd, ".pi", "skills", "tag-test-skill");
    dirsToClean.push(skillDir);

    writeSkill(cwd, "tag-test-skill", "---\nname: my-skill\ndescription: A test skill\n---\n\n# My Skill\n");

    await handleSkillTag(["skill", "tag", "tag-test-skill", "dev-tools"], { cwd, ui });

    const content = readFileSync(join(skillDir, "SKILL.md"), "utf-8");
    expect(content).toContain("module: dev-tools");
    expect(content).toContain("name: my-skill");
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Tagged"), "info");
  });

  it("overwrites existing module in frontmatter", async () => {
    const wrapperSkillDir = join(cwd, WRAPPER_SKILLS_DIR, "tag-test-overwrite");
    dirsToClean.push(wrapperSkillDir);

    writeWrapper(cwd, "tag-test-overwrite", "@/repo/sk", "old-mod");

    await handleSkillTag(["skill", "tag", "tag-test-overwrite", "new-mod"], { cwd, ui });

    const content = readFileSync(join(wrapperSkillDir, "WRAPPER.md"), "utf-8");
    expect(content).toContain("module: new-mod");
    expect(content).not.toContain("old-mod");
  });

  it("prefers WRAPPER.md over SKILL.md when both exist", async () => {
    const wrapperSkillDir = join(cwd, WRAPPER_SKILLS_DIR, "tag-test-prefer");
    const trueSkillDir = join(cwd, ".pi", "skills", "tag-test-prefer");
    dirsToClean.push(wrapperSkillDir);
    dirsToClean.push(trueSkillDir);

    writeWrapper(cwd, "tag-test-prefer", "@/repo/sk");
    writeSkill(cwd, "tag-test-prefer", "---\nname: sk\n---\n");

    await handleSkillTag(["skill", "tag", "tag-test-prefer", "mod"], { cwd, ui });

    const wrapperContent = readFileSync(join(wrapperSkillDir, "WRAPPER.md"), "utf-8");
    expect(wrapperContent).toContain("module: mod");
    const skillContent = readFileSync(join(trueSkillDir, "SKILL.md"), "utf-8");
    expect(skillContent).not.toContain("module:");
  });

  it("errors if skill does not exist", async () => {
    await handleSkillTag(["skill", "tag", "nonexistent-tag-skill", "mod"], { cwd, ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("not found"), "error");
  });
});
