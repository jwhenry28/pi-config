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
});
