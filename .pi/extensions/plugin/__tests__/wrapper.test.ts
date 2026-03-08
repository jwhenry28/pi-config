import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { mkdirSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateWrapperContent, createWrapper, removeWrapper, validateSkillTarget } from "../wrapper.js";
import { getWrappersForPlugin } from "../../shared/skill-wrappers.js";
import { writeFile, writeSkill, writeWrapper } from "../../testutils/fixtures.js";
import { WRAPPER_SKILLS_DIR } from "../../shared/paths.js";
import { setHomeDirOverride, clearHomeDirOverride, getPluginsDir } from "../../shared/home.js";

describe("generateWrapperContent", () => {
  it("generates wrapper without module", () => {
    const content = generateWrapperContent("@/some-repo/skills/my-skill");
    expect(content).toBe("---\nsymlink: '@/some-repo/skills/my-skill'\n---\n");
  });

  it("generates wrapper with module", () => {
    const content = generateWrapperContent("@/some-repo/skills/my-skill", "mymodule");
    expect(content).toBe("---\nsymlink: '@/some-repo/skills/my-skill'\nmodule: mymodule\n---\n");
  });
});

describe("validateSkillTarget", () => {
  const tmpDir = join(process.cwd(), ".test-tmp-wrapper");

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it("returns error if target path does not exist", () => {
    const result = validateSkillTarget("/nonexistent/path");
    expect(result).toContain("does not exist");
  });

  it("returns error if target has no SKILL.md", () => {
    mkdirSync(tmpDir, { recursive: true });
    const result = validateSkillTarget(tmpDir);
    expect(result).toContain("SKILL.md");
  });

  it("returns null if valid", () => {
    writeFile(tmpDir, "SKILL.md", "# Test");
    const result = validateSkillTarget(tmpDir);
    expect(result).toBeNull();
  });
});

describe("createWrapper", () => {
  const cwd = process.cwd();
  const skillName = "test-wrapper-skill";
  const skillDir = join(cwd, WRAPPER_SKILLS_DIR, skillName);

  afterEach(() => {
    if (existsSync(skillDir)) rmSync(skillDir, { recursive: true });
  });

  it("creates WRAPPER.md in skill directory", () => {
    createWrapper(cwd, skillName, "@/repo/skill");
    const content = readFileSync(join(skillDir, "WRAPPER.md"), "utf-8");
    expect(content).toContain("symlink: '@/repo/skill'");
  });

  it("throws if WRAPPER.md already exists", () => {
    createWrapper(cwd, skillName, "@/repo/skill");
    expect(() => createWrapper(cwd, skillName, "@/repo/skill2")).toThrow("already exists");
  });

  it("does not conflict with SKILL.md in .pi/skills/ (different directory)", () => {
    writeSkill(cwd, skillName, "# Real skill");
    createWrapper(cwd, skillName, "@/repo/skill");
    const content = readFileSync(join(skillDir, "WRAPPER.md"), "utf-8");
    expect(content).toContain("symlink: '@/repo/skill'");
    // Clean up the .pi/skills version too
    const trueSkillDir = join(cwd, ".pi", "skills", skillName);
    if (existsSync(trueSkillDir)) rmSync(trueSkillDir, { recursive: true });
  });
});

describe("removeWrapper", () => {
  const cwd = process.cwd();
  const skillName = "test-remove-skill";
  const skillDir = join(cwd, WRAPPER_SKILLS_DIR, skillName);

  afterEach(() => {
    if (existsSync(skillDir)) rmSync(skillDir, { recursive: true });
  });

  it("removes WRAPPER.md and empty directory", () => {
    createWrapper(cwd, skillName, "@/repo/skill");
    removeWrapper(cwd, skillName);
    expect(existsSync(skillDir)).toBe(false);
  });

  it("throws if no WRAPPER.md exists", () => {
    expect(() => removeWrapper(cwd, skillName)).toThrow();
  });
});

describe("getWrappersForPlugin", () => {
  const tmpDir = join(process.cwd(), ".test-tmp-gwfp");

  beforeEach(() => {
    setHomeDirOverride(tmpDir);
  });

  afterEach(() => {
    clearHomeDirOverride();
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns wrappers whose realSkillDir is inside the named plugin", () => {
    const pluginsDir = getPluginsDir();
    mkdirSync(join(pluginsDir, "my-repo/skills/my-skill"), { recursive: true });
    writeFileSync(join(pluginsDir, "my-repo/skills/my-skill/SKILL.md"), "---\nname: my-skill\ndescription: test\n---\n");
    writeWrapper(tmpDir, "my-skill", "my-repo/skills/my-skill");

    const result = getWrappersForPlugin(tmpDir, "my-repo");
    expect(result).toHaveLength(1);
    expect(result[0].dirName).toBe("my-skill");
  });

  it("excludes wrappers pointing to different plugins", () => {
    const pluginsDir = getPluginsDir();
    for (const repo of ["repo-a", "repo-b"]) {
      mkdirSync(join(pluginsDir, `${repo}/skills/skill-${repo}`), { recursive: true });
      writeFileSync(join(pluginsDir, `${repo}/skills/skill-${repo}/SKILL.md`), `---\nname: skill-${repo}\ndescription: test\n---\n`);
      writeWrapper(tmpDir, `skill-${repo}`, `${repo}/skills/skill-${repo}`);
    }

    const result = getWrappersForPlugin(tmpDir, "repo-a");
    expect(result).toHaveLength(1);
    expect(result[0].dirName).toBe("skill-repo-a");
  });

  it("resolves symlinks with surrounding quotes", () => {
    const pluginsDir = getPluginsDir();
    mkdirSync(join(pluginsDir, "my-repo/skills/quoted-skill"), { recursive: true });
    writeFileSync(join(pluginsDir, "my-repo/skills/quoted-skill/SKILL.md"), "---\nname: quoted-skill\ndescription: test\n---\n");
    writeWrapper(tmpDir, "quoted-skill", "my-repo/skills/quoted-skill");

    const result = getWrappersForPlugin(tmpDir, "my-repo");
    expect(result).toHaveLength(1);
    expect(result[0].dirName).toBe("quoted-skill");
  });

  it("returns empty array when no wrappers match", () => {
    mkdirSync(join(tmpDir, WRAPPER_SKILLS_DIR), { recursive: true });
    const result = getWrappersForPlugin(tmpDir, "nonexistent");
    expect(result).toHaveLength(0);
  });
});
