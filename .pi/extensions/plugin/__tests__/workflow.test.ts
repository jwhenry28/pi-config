import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setHomeDirOverride, clearHomeDirOverride, getPluginsDir } from "../../shared/home.js";
import { WORKFLOWS_DIR } from "../../shared/paths.js";
import { handleWorkflowAdd, handleWorkflowRemove } from "../workflow.js";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const tmpHome = join(tmpdir(), `pi-test-workflow-${process.pid}`);

function makeTmpCwd(): string {
  const dir = join(tmpdir(), `pi-test-workflow-cwd-${randomBytes(4).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("handleWorkflowAdd", () => {
  let cwd: string;
  const notify = vi.fn();
  const ui = { notify, confirm: vi.fn(), setStatus: vi.fn() } as any;
  const dirsToClean: string[] = [];

  beforeEach(() => {
    cwd = makeTmpCwd();
    dirsToClean.push(cwd);
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

  it("errors on missing name argument", async () => {
    await handleWorkflowAdd(["workflow", "add"], { cwd, ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Usage"), "warning");
  });

  it("copies workflow yml from plugin repo to .pi-config/workflows/", async () => {
    const pluginsDir = getPluginsDir();
    const repoWorkflowsDir = join(pluginsDir, "my-repo/workflows");
    mkdirSync(repoWorkflowsDir, { recursive: true });
    writeFileSync(join(repoWorkflowsDir, "deploy.yml"), "name: deploy\nsteps: []");
    dirsToClean.push(join(pluginsDir, "my-repo"));

    const destDir = join(cwd, WORKFLOWS_DIR);

    await handleWorkflowAdd(["workflow", "add", "deploy"], { cwd, ui });

    expect(existsSync(join(destDir, "deploy.yml"))).toBe(true);
    expect(readFileSync(join(destDir, "deploy.yml"), "utf-8")).toBe("name: deploy\nsteps: []");
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Added"), "info");
  });

  it("errors if workflow not found in any repo", async () => {
    const pluginsDir = getPluginsDir();
    mkdirSync(join(pluginsDir, "empty-repo/workflows"), { recursive: true });
    dirsToClean.push(join(pluginsDir, "empty-repo"));

    await handleWorkflowAdd(["workflow", "add", "nonexistent"], { cwd, ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("not found"), "error");
  });

  it("errors if workflow already exists locally", async () => {
    const pluginsDir = getPluginsDir();
    mkdirSync(join(pluginsDir, "repo-a/workflows"), { recursive: true });
    writeFileSync(join(pluginsDir, "repo-a/workflows/dupe.yml"), "name: dupe");
    dirsToClean.push(join(pluginsDir, "repo-a"));

    const destDir = join(cwd, WORKFLOWS_DIR);
    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(destDir, "dupe.yml"), "existing");

    await handleWorkflowAdd(["workflow", "add", "dupe"], { cwd, ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("already exists"), "error");
  });

  it("errors if workflow found in multiple repos", async () => {
    const pluginsDir = getPluginsDir();
    for (const repo of ["repo-x", "repo-y"]) {
      mkdirSync(join(pluginsDir, repo, "workflows"), { recursive: true });
      writeFileSync(join(pluginsDir, repo, "workflows", "ambig.yml"), `name: ${repo}`);
      dirsToClean.push(join(pluginsDir, repo));
    }

    await handleWorkflowAdd(["workflow", "add", "ambig"], { cwd, ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("multiple"), "error");
  });
});

describe("handleWorkflowRemove", () => {
  let cwd: string;
  const notify = vi.fn();
  const ui = { notify, confirm: vi.fn(), setStatus: vi.fn() } as any;
  const dirsToClean: string[] = [];

  beforeEach(() => {
    cwd = makeTmpCwd();
    dirsToClean.push(cwd);
  });

  afterEach(() => {
    for (const d of dirsToClean) {
      if (existsSync(d)) rmSync(d, { recursive: true });
    }
    dirsToClean.length = 0;
    vi.restoreAllMocks();
  });

  it("errors on missing name argument", async () => {
    await handleWorkflowRemove(["workflow", "remove"], { cwd, ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Usage"), "warning");
  });

  it("removes existing workflow file", async () => {
    const destDir = join(cwd, WORKFLOWS_DIR);
    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(destDir, "my-flow.yml"), "name: my-flow");

    await handleWorkflowRemove(["workflow", "remove", "my-flow"], { cwd, ui });

    expect(existsSync(join(destDir, "my-flow.yml"))).toBe(false);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Removed"), "info");
  });

  it("errors if workflow file does not exist", async () => {
    await handleWorkflowRemove(["workflow", "remove", "ghost"], { cwd, ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("not found"), "error");
  });
});
