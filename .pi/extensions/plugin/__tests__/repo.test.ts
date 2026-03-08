import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { handleRepoDownload, handleRepoUpdate, handleRepoRemove } from "../repo.js";
import * as git from "../git.js";
import { existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { getWrappersForPlugin } from "../../shared/skill-wrappers.js";
import { WRAPPER_SKILLS_DIR } from "../../shared/paths.js";
import { setHomeDirOverride, clearHomeDirOverride } from "../../shared/home.js";
import type { PathLike } from "node:fs";

const FAKE_HOME = "/tmp/fake-home";
const FAKE_PLUGINS = "/tmp/fake-home/.pi/plugins";

vi.mock("@mariozechner/pi-coding-agent", () => ({
  BorderedLoader: vi.fn().mockImplementation(() => ({ onAbort: undefined })),
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    rmSync: vi.fn(),
    readdirSync: vi.fn(),
  };
});

vi.mock("../../shared/skill-wrappers.js", () => ({
  getWrappersForPlugin: vi.fn().mockReturnValue([]),
}));

const mockExistsSync = vi.mocked(existsSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockRmSync = vi.mocked(rmSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockGetWrappersForPlugin = vi.mocked(getWrappersForPlugin);

describe("handleRepoDownload", () => {
  const notify = vi.fn();
  const custom = vi.fn();
  const ui = { notify, confirm: vi.fn(), setStatus: vi.fn(), custom };

  beforeEach(() => {
    setHomeDirOverride(FAKE_HOME);
    custom.mockImplementation((factory: any) => {
      return new Promise((resolve) => {
        const done = (result: any) => resolve(result);
        try { factory(null, null, null, done); } catch { /* ignore BorderedLoader construction errors */ }
        // If factory crashed before setting up async handlers, resolve after microtask
        Promise.resolve().then(() => resolve({ ok: true }));
      });
    });
  });

  afterEach(() => {
    clearHomeDirOverride();
    vi.restoreAllMocks();
  });

  it("errors on missing URL argument", async () => {
    await handleRepoDownload(["repo", "download"], { cwd: "/tmp", ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Usage"), "warning");
  });

  it("clones repo into .pi/plugins/ and verifies skills dir", async () => {
    const spy = vi.spyOn(git, "runGitAsync").mockResolvedValue("");
    mockExistsSync.mockImplementation((p: PathLike) => {
      const s = String(p);
      if (s === `${FAKE_PLUGINS}/repo`) return false;
      if (s === `${FAKE_PLUGINS}/repo/skills`) return true;
      return false;
    });
    mockMkdirSync.mockReturnValue(undefined as any);

    await handleRepoDownload(["repo", "download", "org/repo"], { cwd: "/tmp", ui });

    expect(mockMkdirSync).toHaveBeenCalledWith(`${FAKE_PLUGINS}`, { recursive: true });
    expect(spy).toHaveBeenCalledWith(
      ["clone", "--depth", "1", "https://github.com/org/repo.git", `${FAKE_PLUGINS}/repo`],
      "/tmp"
    );
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("repo"), "info");
  });

  it("errors if plugin directory already exists", async () => {
    mockExistsSync.mockImplementation((p: PathLike) => {
      if (String(p) === `${FAKE_PLUGINS}/repo`) return true;
      return false;
    });

    await handleRepoDownload(["repo", "download", "org/repo"], { cwd: "/tmp", ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("already exists"), "error");
  });

  it("removes clone and errors if no skills, skill-library, or workflows dir", async () => {
    const spy = vi.spyOn(git, "runGitAsync").mockResolvedValue("");
    mockExistsSync.mockImplementation((p: PathLike) => {
      const s = String(p);
      if (s === `${FAKE_PLUGINS}/repo`) return false;
      if (s === `${FAKE_PLUGINS}/repo/skills`) return false;
      if (s === `${FAKE_PLUGINS}/repo/skill-library`) return false;
      if (s === `${FAKE_PLUGINS}/repo/workflows`) return false;
      return false;
    });
    mockMkdirSync.mockReturnValue(undefined as any);
    mockRmSync.mockReturnValue(undefined);

    await handleRepoDownload(["repo", "download", "org/repo"], { cwd: "/tmp", ui });

    expect(mockRmSync).toHaveBeenCalledWith(`${FAKE_PLUGINS}/repo`, { recursive: true, force: true });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("no skills, skill-library, or workflows"), "error");
  });

  it("accepts repo with only workflows dir", async () => {
    const spy = vi.spyOn(git, "runGitAsync").mockResolvedValue("");
    mockExistsSync.mockImplementation((p: PathLike) => {
      const s = String(p);
      if (s === `${FAKE_PLUGINS}/repo`) return false;
      if (s === `${FAKE_PLUGINS}/repo/skills`) return false;
      if (s === `${FAKE_PLUGINS}/repo/skill-library`) return false;
      if (s === `${FAKE_PLUGINS}/repo/workflows`) return true;
      return false;
    });
    mockMkdirSync.mockReturnValue(undefined as any);

    await handleRepoDownload(["repo", "download", "org/repo"], { cwd: "/tmp", ui });

    expect(mockRmSync).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("repo"), "info");
  });

  it("accepts optional alias argument", async () => {
    const spy = vi.spyOn(git, "runGitAsync").mockResolvedValue("");
    mockExistsSync.mockImplementation((p: PathLike) => {
      const s = String(p);
      if (s === `${FAKE_PLUGINS}/my-alias`) return false;
      if (s === `${FAKE_PLUGINS}/my-alias/skills`) return true;
      return false;
    });
    mockMkdirSync.mockReturnValue(undefined as any);

    await handleRepoDownload(["repo", "download", "org/repo", "my-alias"], { cwd: "/tmp", ui });

    expect(spy).toHaveBeenCalledWith(
      ["clone", "--depth", "1", "https://github.com/org/repo.git", `${FAKE_PLUGINS}/my-alias`],
      "/tmp"
    );
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("my-alias"), "info");
  });
});

describe("handleRepoUpdate", () => {
  const notify = vi.fn();
  const custom = vi.fn();
  const ui = { notify, confirm: vi.fn(), setStatus: vi.fn(), custom };

  beforeEach(() => { setHomeDirOverride(FAKE_HOME); custom.mockResolvedValue({ ok: true }); });
  afterEach(() => { clearHomeDirOverride(); vi.restoreAllMocks(); });

  it("pulls latest for named plugin", async () => {
    mockExistsSync.mockImplementation((p: PathLike) => {
      if (String(p) === `${FAKE_PLUGINS}/repo`) return true;
      return false;
    });

    await handleRepoUpdate(["repo", "update", "repo"], { cwd: "/tmp", ui });

    expect(custom).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("repo"), "info");
  });

  it("errors if named plugin directory does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await handleRepoUpdate(["repo", "update", "repo"], { cwd: "/tmp", ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("not found"), "error");
  });

  it("updates all plugins when name omitted", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["repo-a", "repo-b"] as any);

    await handleRepoUpdate(["repo", "update"], { cwd: "/tmp", ui });

    expect(custom).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Updated 2"), "info");
  });

  it("reports no plugins when .pi/plugins/ does not exist and name omitted", async () => {
    mockExistsSync.mockReturnValue(false);

    await handleRepoUpdate(["repo", "update"], { cwd: "/tmp", ui });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("No plugins found"), "info");
  });

  it("continues on failure and reports errors for update-all", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["repo-a", "repo-b"] as any);
    let callCount = 0;
    custom.mockImplementation(async () => {
      callCount++;
      // First call (repo-a) fails, second (repo-b) succeeds
      return callCount === 1 ? { ok: false, error: "network error" } : { ok: true };
    });

    await handleRepoUpdate(["repo", "update"], { cwd: "/tmp", ui });

    expect(custom).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("repo-a"), "warning");
  });
});

describe("handleRepoRemove", () => {
  const notify = vi.fn();
  const confirm = vi.fn();
  const ui = { notify, confirm, setStatus: vi.fn() };
  const tex = { cwd: "/tmp", ui };

  beforeEach(() => { setHomeDirOverride(FAKE_HOME); });
  afterEach(() => { clearHomeDirOverride(); vi.restoreAllMocks(); });

  it("errors on missing name argument", async () => {
    await handleRepoRemove(["repo", "remove"], tex);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Usage"), "warning");
  });

  it("errors if plugin directory does not exist", async () => {
    mockExistsSync.mockReturnValue(false);
    await handleRepoRemove(["repo", "remove", "my-repo"], tex);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("not found"), "error");
  });

  it("deletes repo with no uncommitted changes and no wrappers", async () => {
    mockExistsSync.mockReturnValue(true);
    vi.spyOn(git, "runGit").mockReturnValue("");
    mockGetWrappersForPlugin.mockReturnValue([]);

    await handleRepoRemove(["repo", "remove", "my-repo"], tex);

    expect(mockRmSync).toHaveBeenCalledWith(`${FAKE_PLUGINS}/my-repo`, { recursive: true, force: true });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Removed repo "my-repo"'), "info");
  });

  it("prompts on uncommitted changes and aborts if user declines", async () => {
    mockExistsSync.mockReturnValue(true);
    vi.spyOn(git, "runGit").mockImplementation((args) => {
      if (args[0] === "status") return " M dirty-file.ts";
      if (args[0] === "log") return "";
      return "";
    });
    confirm.mockResolvedValue(false);

    await handleRepoRemove(["repo", "remove", "my-repo"], tex);

    expect(confirm).toHaveBeenCalled();
    expect(mockRmSync).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("Aborted"), "info");
  });

  it("prompts on uncommitted changes and proceeds if user confirms", async () => {
    mockExistsSync.mockReturnValue(true);
    vi.spyOn(git, "runGit").mockImplementation((args) => {
      if (args[0] === "status") return " M dirty-file.ts";
      if (args[0] === "log") return "";
      return "";
    });
    confirm.mockResolvedValue(true);
    mockGetWrappersForPlugin.mockReturnValue([]);

    await handleRepoRemove(["repo", "remove", "my-repo"], tex);

    expect(mockRmSync).toHaveBeenCalledWith(`${FAKE_PLUGINS}/my-repo`, { recursive: true, force: true });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Removed repo "my-repo"'), "info");
  });

  it("prompts on unpushed commits", async () => {
    mockExistsSync.mockReturnValue(true);
    vi.spyOn(git, "runGit").mockImplementation((args) => {
      if (args[0] === "status") return "";
      if (args[0] === "log") return "abc123 some commit";
      return "";
    });
    confirm.mockResolvedValue(false);

    await handleRepoRemove(["repo", "remove", "my-repo"], tex);

    expect(confirm).toHaveBeenCalled();
    expect(mockRmSync).not.toHaveBeenCalled();
  });

  it("deletes associated wrappers and reports count", async () => {
    mockExistsSync.mockReturnValue(true);
    vi.spyOn(git, "runGit").mockReturnValue("");
    mockGetWrappersForPlugin.mockReturnValue([
      { dirName: "skill-a", wrapperPath: "/tmp/.pi-config/skills/skill-a/WRAPPER.md", realSkillDir: "", realSkillFile: "", wrapperFrontmatter: {} },
      { dirName: "skill-b", wrapperPath: "/tmp/.pi-config/skills/skill-b/WRAPPER.md", realSkillDir: "", realSkillFile: "", wrapperFrontmatter: {} },
    ]);

    await handleRepoRemove(["repo", "remove", "my-repo"], tex);

    expect(mockRmSync).toHaveBeenCalledWith("/tmp/.pi-config/skills/skill-a", { recursive: true, force: true });
    expect(mockRmSync).toHaveBeenCalledWith("/tmp/.pi-config/skills/skill-b", { recursive: true, force: true });
    expect(mockRmSync).toHaveBeenCalledWith(`${FAKE_PLUGINS}/my-repo`, { recursive: true, force: true });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("2 associated skill wrappers"), "info");
  });

  it("handles git errors gracefully (e.g. no upstream)", async () => {
    mockExistsSync.mockReturnValue(true);
    vi.spyOn(git, "runGit").mockImplementation((args) => {
      if (args[0] === "status") return "";
      if (args[0] === "log") throw new Error("no upstream");
      return "";
    });
    mockGetWrappersForPlugin.mockReturnValue([]);

    await handleRepoRemove(["repo", "remove", "my-repo"], tex);

    expect(mockRmSync).toHaveBeenCalledWith(`${FAKE_PLUGINS}/my-repo`, { recursive: true, force: true });
  });
});
