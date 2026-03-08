import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFile } from "../../testutils/fixtures.js";
import { WRAPPER_SKILLS_DIR } from "../../shared/paths.js";
import { setHomeDirOverride, clearHomeDirOverride, getPluginsDir } from "../../shared/home.js";
import {
  listPluginRepos,
  listWrapperSkills,
  getRepoNameCompletions,
  getWrapperSkillCompletions,
  getSkillAddPathCompletions,
  getWorkflowAddCompletions,
  getLocalWorkflowCompletions,
} from "../completions.js";
import { WORKFLOWS_DIR } from "../../shared/paths.js";

const cwd = process.cwd();
const tmpHome = join(tmpdir(), `pi-test-completions-${process.pid}`);
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
  if (existsSync(tmpHome)) rmSync(tmpHome, { recursive: true });
});

function setupPluginRepo(name: string, skillDirs: string[] = []) {
  const pluginsDir = getPluginsDir();
  const repoDir = join(pluginsDir, name);
  mkdirSync(repoDir, { recursive: true });
  writeFileSync(join(repoDir, ".gitkeep"), "");
  for (const sd of skillDirs) {
    const skillDir = join(repoDir, sd);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), `# ${sd}`);
  }
  dirsToClean.push(repoDir);
}

function setupWrapper(skillName: string) {
  writeFile(cwd, `${WRAPPER_SKILLS_DIR}/${skillName}/WRAPPER.md`, `---\nsymlink: 'repo/${skillName}'\n---\n`);
  dirsToClean.push(join(cwd, WRAPPER_SKILLS_DIR, skillName));
}

describe("listPluginRepos", () => {
  it("returns empty when no plugins dir", () => {
    setHomeDirOverride("/tmp/nonexistent-test-dir");
    const repos = listPluginRepos();
    expect(repos).toEqual([]);
    setHomeDirOverride(tmpHome);
  });

  it("lists plugin repo directories", () => {
    setupPluginRepo("test-repo-a");
    setupPluginRepo("test-repo-b");
    const repos = listPluginRepos();
    expect(repos).toContain("test-repo-a");
    expect(repos).toContain("test-repo-b");
  });
});

describe("getRepoNameCompletions", () => {
  it("filters repos by prefix", () => {
    setupPluginRepo("alpha-repo");
    setupPluginRepo("beta-repo");
    const result = getRepoNameCompletions("remove", "alpha");
    expect(result).toHaveLength(1);
    expect(result![0].value).toBe("repo remove alpha-repo");
    expect(result![0].label).toBe("alpha-repo");
  });

  it("returns null when no match", () => {
    setupPluginRepo("alpha-repo");
    expect(getRepoNameCompletions("remove", "zzz")).toBeNull();
  });
});

describe("getWrapperSkillCompletions", () => {
  it("filters wrapper skills by prefix", () => {
    setupWrapper("test-skill-x");
    setupWrapper("test-skill-y");
    const result = getWrapperSkillCompletions("remove", "test-skill-x", cwd);
    expect(result).toHaveLength(1);
    expect(result![0].value).toBe("skill remove test-skill-x");
  });

  it("returns null when no match", () => {
    expect(getWrapperSkillCompletions("remove", "zzz-nonexistent", cwd)).toBeNull();
  });
});

describe("getSkillAddPathCompletions", () => {
  it("lists all skills with empty prefix", () => {
    setupPluginRepo("repo-a", ["skill-library/skill-one"]);
    setupPluginRepo("repo-b", ["skills/skill-two"]);
    const result = getSkillAddPathCompletions("");
    expect(result).not.toBeNull();
    const values = result!.map(r => r.value);
    expect(values).toContain("skill add repo-a/skill-library/skill-one");
    expect(values).toContain("skill add repo-b/skills/skill-two");
  });

  it("filters by contains match", () => {
    setupPluginRepo("my-repo", ["skill-library/cool-skill", "skill-library/other-thing"]);
    const result = getSkillAddPathCompletions("cool");
    expect(result).toHaveLength(1);
    expect(result![0].value).toBe("skill add my-repo/skill-library/cool-skill");
    expect(result![0].label).toBe("cool-skill");
    expect(result![0].description).toBe("my-repo/skill-library/cool-skill");
  });

  it("finds nested skills recursively", () => {
    const pluginsDir = getPluginsDir();
    mkdirSync(join(pluginsDir, "nav-repo/skill-library/category/sub-skill"), { recursive: true });
    writeFileSync(join(pluginsDir, "nav-repo/skill-library/category/sub-skill/SKILL.md"), "# Sub");
    dirsToClean.push(join(pluginsDir, "nav-repo"));

    const result = getSkillAddPathCompletions("sub-skill");
    expect(result).not.toBeNull();
    expect(result![0].value).toBe("skill add nav-repo/skill-library/category/sub-skill");
  });

  it("matches anywhere in path", () => {
    setupPluginRepo("praetorian-eng", ["skill-library/adding-filters"]);
    const result = getSkillAddPathCompletions("praetorian");
    expect(result).not.toBeNull();
    expect(result![0].value).toBe("skill add praetorian-eng/skill-library/adding-filters");
  });

  it("returns null when no match", () => {
    setupPluginRepo("my-repo", ["skill-library/cool-skill"]);
    expect(getSkillAddPathCompletions("zzz-nonexistent")).toBeNull();
  });

  it("returns null when no plugins dir", () => {
    setHomeDirOverride("/tmp/nonexistent-test-dir");
    expect(getSkillAddPathCompletions("anything")).toBeNull();
    setHomeDirOverride(tmpHome);
  });
});

describe("getWorkflowAddCompletions", () => {
  it("lists workflow yml files from plugin repos", () => {
    const pluginsDir = getPluginsDir();
    const wfDir = join(pluginsDir, "my-repo/workflows");
    mkdirSync(wfDir, { recursive: true });
    writeFileSync(join(wfDir, "deploy.yml"), "name: deploy");
    writeFileSync(join(wfDir, "build.yml"), "name: build");
    dirsToClean.push(join(pluginsDir, "my-repo"));

    const result = getWorkflowAddCompletions("");
    expect(result).not.toBeNull();
    const values = result!.map(r => r.value);
    expect(values).toContain("workflow add deploy");
    expect(values).toContain("workflow add build");
  });

  it("filters by prefix", () => {
    const pluginsDir = getPluginsDir();
    const wfDir = join(pluginsDir, "repo-wf/workflows");
    mkdirSync(wfDir, { recursive: true });
    writeFileSync(join(wfDir, "deploy.yml"), "name: deploy");
    writeFileSync(join(wfDir, "build.yml"), "name: build");
    dirsToClean.push(join(pluginsDir, "repo-wf"));

    const result = getWorkflowAddCompletions("dep");
    expect(result).toHaveLength(1);
    expect(result![0].value).toBe("workflow add deploy");
    expect(result![0].description).toBe("repo-wf");
  });

  it("returns null when no match", () => {
    const pluginsDir = getPluginsDir();
    mkdirSync(join(pluginsDir, "empty-wf/workflows"), { recursive: true });
    dirsToClean.push(join(pluginsDir, "empty-wf"));
    expect(getWorkflowAddCompletions("zzz")).toBeNull();
  });
});

describe("getLocalWorkflowCompletions", () => {
  it("lists local workflow files", () => {
    const wfDir = join(cwd, WORKFLOWS_DIR);
    mkdirSync(wfDir, { recursive: true });
    writeFileSync(join(wfDir, "ci.yml"), "name: ci");
    writeFileSync(join(wfDir, "release.yml"), "name: release");
    dirsToClean.push(wfDir);

    const result = getLocalWorkflowCompletions("", cwd);
    expect(result).not.toBeNull();
    const values = result!.map(r => r.value);
    expect(values).toContain("workflow remove ci");
    expect(values).toContain("workflow remove release");
  });

  it("filters by prefix", () => {
    const wfDir = join(cwd, WORKFLOWS_DIR);
    mkdirSync(wfDir, { recursive: true });
    writeFileSync(join(wfDir, "ci.yml"), "name: ci");
    writeFileSync(join(wfDir, "release.yml"), "name: release");
    dirsToClean.push(wfDir);

    const result = getLocalWorkflowCompletions("ci", cwd);
    expect(result).toHaveLength(1);
    expect(result![0].value).toBe("workflow remove ci");
  });

  it("returns null when no workflows dir", () => {
    expect(getLocalWorkflowCompletions("", "/tmp/nonexistent")).toBeNull();
  });
});
