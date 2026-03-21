import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setHomeDirOverride, clearHomeDirOverride, getPluginsDir } from "../home.js";
import { setEnabledPlugins } from "../plugins.js";
import { purgeStore } from "../../testutils/index.js";
import { getPluginSkillPaths } from "../../skill-loader.js";

const cwd = process.cwd();
let tmpHome: string;

describe("getPluginSkillPaths", () => {
  beforeEach(() => {
    tmpHome = join(cwd, ".test-home-" + Date.now());
    mkdirSync(tmpHome, { recursive: true });
    setHomeDirOverride(tmpHome);
  });

  afterEach(() => {
    clearHomeDirOverride();
    if (existsSync(tmpHome)) rmSync(tmpHome, { recursive: true, force: true });
    purgeStore(cwd, "pi-config");
  });

  it("returns empty array when no plugins enabled", () => {
    expect(getPluginSkillPaths(cwd)).toEqual([]);
  });

  it("returns skill paths from enabled plugin", () => {
    const pluginsDir = getPluginsDir();
    const skillDir = join(pluginsDir, "test-repo", "skills", "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: my-skill\ndescription: test\n---\n# Test");

    setEnabledPlugins(cwd, ["test-repo"]);
    const paths = getPluginSkillPaths(cwd);

    expect(paths).toHaveLength(1);
    expect(paths[0]).toBe(skillDir);
  });

  it("ignores disabled plugins", () => {
    const pluginsDir = getPluginsDir();
    const skillDir = join(pluginsDir, "disabled-repo", "skills", "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: my-skill\ndescription: test\n---\n# Test");

    expect(getPluginSkillPaths(cwd)).toEqual([]);
  });

  it("skips directories without SKILL.md", () => {
    const pluginsDir = getPluginsDir();
    mkdirSync(join(pluginsDir, "test-repo", "skills", "not-a-skill"), { recursive: true });

    setEnabledPlugins(cwd, ["test-repo"]);
    expect(getPluginSkillPaths(cwd)).toEqual([]);
  });

  it("returns skill paths from skill-library recursively", () => {
    const pluginsDir = getPluginsDir();
    const deepSkillDir = join(pluginsDir, "test-repo", "skill-library", "category", "subcategory", "my-deep-skill");
    mkdirSync(deepSkillDir, { recursive: true });
    writeFileSync(join(deepSkillDir, "SKILL.md"), "---\nname: deep-skill\ndescription: test\n---\n# Deep");

    const topSkillDir = join(pluginsDir, "test-repo", "skill-library", "top-skill");
    mkdirSync(topSkillDir, { recursive: true });
    writeFileSync(join(topSkillDir, "SKILL.md"), "---\nname: top-skill\ndescription: test\n---\n# Top");

    setEnabledPlugins(cwd, ["test-repo"]);
    const paths = getPluginSkillPaths(cwd);

    expect(paths).toHaveLength(2);
    expect(paths).toContain(deepSkillDir);
    expect(paths).toContain(topSkillDir);
  });

  it("returns skills from both skills/ and skill-library/ directories", () => {
    const pluginsDir = getPluginsDir();

    const classicSkillDir = join(pluginsDir, "test-repo", "skills", "classic-skill");
    mkdirSync(classicSkillDir, { recursive: true });
    writeFileSync(join(classicSkillDir, "SKILL.md"), "---\nname: classic\ndescription: test\n---\n# Classic");

    const libSkillDir = join(pluginsDir, "test-repo", "skill-library", "lib-skill");
    mkdirSync(libSkillDir, { recursive: true });
    writeFileSync(join(libSkillDir, "SKILL.md"), "---\nname: lib\ndescription: test\n---\n# Lib");

    setEnabledPlugins(cwd, ["test-repo"]);
    const paths = getPluginSkillPaths(cwd);

    expect(paths).toHaveLength(2);
    expect(paths).toContain(classicSkillDir);
    expect(paths).toContain(libSkillDir);
  });

  it("skips skill-library directories without SKILL.md", () => {
    const pluginsDir = getPluginsDir();
    mkdirSync(join(pluginsDir, "test-repo", "skill-library", "no-skill-here"), { recursive: true });

    setEnabledPlugins(cwd, ["test-repo"]);
    expect(getPluginSkillPaths(cwd)).toEqual([]);
  });
});
