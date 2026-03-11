import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { handleDownload, handleUpdate, handleRemove, handleList } from "../handlers.js";
import * as git from "../git.js";
import { existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { setHomeDirOverride, clearHomeDirOverride } from "../../shared/home.js";
import type { PathLike } from "node:fs";
import type { PluginUI } from "../constants.js";

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

const mockExistsSync = vi.mocked(existsSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockRmSync = vi.mocked(rmSync);
const mockReaddirSync = vi.mocked(readdirSync);

function makeMockUI(): PluginUI & { notify: ReturnType<typeof vi.fn>; confirm: ReturnType<typeof vi.fn>; custom: ReturnType<typeof vi.fn> } {
  return { notify: vi.fn(), confirm: vi.fn(), custom: vi.fn() };
}

describe("handleDownload", () => {
  const ui = makeMockUI();

  beforeEach(() => {
    setHomeDirOverride(FAKE_HOME);
    ui.custom.mockImplementation((factory: any) => {
      return new Promise((resolve) => {
        const done = (result: any) => resolve(result);
        try { factory(null, null, null, done); } catch { /* ignore BorderedLoader construction errors */ }
        Promise.resolve().then(() => resolve({ ok: true }));
      });
    });
  });

  afterEach(() => {
    clearHomeDirOverride();
    vi.restoreAllMocks();
  });

  it("errors on missing URL argument", async () => {
    await handleDownload(["download"], { cwd: "/tmp", ui });
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("Usage"), "warning");
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

    await handleDownload(["download", "org/repo"], { cwd: "/tmp", ui });

    expect(mockMkdirSync).toHaveBeenCalledWith(`${FAKE_PLUGINS}`, { recursive: true });
    expect(spy).toHaveBeenCalledWith(
      ["clone", "--depth", "1", "https://github.com/org/repo.git", `${FAKE_PLUGINS}/repo`],
      "/tmp"
    );
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("repo"), "info");
  });

  it("errors if plugin directory already exists", async () => {
    mockExistsSync.mockImplementation((p: PathLike) => {
      if (String(p) === `${FAKE_PLUGINS}/repo`) return true;
      return false;
    });

    await handleDownload(["download", "org/repo"], { cwd: "/tmp", ui });
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("already exists"), "error");
  });

  it("removes clone and errors if no skills or workflows dir", async () => {
    vi.spyOn(git, "runGitAsync").mockResolvedValue("");
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined as any);
    mockRmSync.mockReturnValue(undefined);

    await handleDownload(["download", "org/repo"], { cwd: "/tmp", ui });

    expect(mockRmSync).toHaveBeenCalledWith(`${FAKE_PLUGINS}/repo`, { recursive: true, force: true });
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("no skills/ or workflows/"), "error");
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

    await handleDownload(["download", "org/repo", "my-alias"], { cwd: "/tmp", ui });

    expect(spy).toHaveBeenCalledWith(
      ["clone", "--depth", "1", "https://github.com/org/repo.git", `${FAKE_PLUGINS}/my-alias`],
      "/tmp"
    );
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("my-alias"), "info");
  });
});

describe("handleUpdate", () => {
  const ui = makeMockUI();

  beforeEach(() => { setHomeDirOverride(FAKE_HOME); ui.custom.mockResolvedValue({ ok: true }); });
  afterEach(() => { clearHomeDirOverride(); vi.restoreAllMocks(); });

  it("pulls latest for named plugin", async () => {
    mockExistsSync.mockImplementation((p: PathLike) => {
      if (String(p) === `${FAKE_PLUGINS}/repo`) return true;
      return false;
    });

    await handleUpdate(["update", "repo"], { cwd: "/tmp", ui });

    expect(ui.custom).toHaveBeenCalledTimes(1);
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("repo"), "info");
  });

  it("errors if named plugin directory does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await handleUpdate(["update", "repo"], { cwd: "/tmp", ui });
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("not found"), "error");
  });

  it("updates all plugins when name omitted", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(["repo-a", "repo-b"] as any);

    await handleUpdate(["update"], { cwd: "/tmp", ui });

    expect(ui.custom).toHaveBeenCalledTimes(2);
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("Updated 2"), "info");
  });

  it("reports no plugins when .pi/plugins/ does not exist and name omitted", async () => {
    mockExistsSync.mockReturnValue(false);

    await handleUpdate(["update"], { cwd: "/tmp", ui });
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("No plugins found"), "info");
  });
});

describe("handleRemove", () => {
  const ui = makeMockUI();
  const tex = { cwd: "/tmp", ui };

  beforeEach(() => { setHomeDirOverride(FAKE_HOME); });
  afterEach(() => { clearHomeDirOverride(); vi.restoreAllMocks(); });

  it("errors on missing name argument", async () => {
    await handleRemove(["remove"], tex);
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("Usage"), "warning");
  });

  it("errors if plugin directory does not exist", async () => {
    mockExistsSync.mockReturnValue(false);
    await handleRemove(["remove", "my-repo"], tex);
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("not found"), "error");
  });

  it("deletes repo with no uncommitted changes", async () => {
    mockExistsSync.mockImplementation((p: PathLike) => {
      return String(p) === `${FAKE_PLUGINS}/my-repo`;
    });
    vi.spyOn(git, "runGit").mockReturnValue("");

    await handleRemove(["remove", "my-repo"], tex);

    expect(mockRmSync).toHaveBeenCalledWith(`${FAKE_PLUGINS}/my-repo`, { recursive: true, force: true });
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining('Removed repo "my-repo"'), "info");
  });

  it("prompts on uncommitted changes and aborts if user declines", async () => {
    mockExistsSync.mockImplementation((p: PathLike) => String(p) === `${FAKE_PLUGINS}/my-repo`);
    vi.spyOn(git, "runGit").mockImplementation((args) => {
      if (args[0] === "status") return " M dirty-file.ts";
      if (args[0] === "log") return "";
      return "";
    });
    ui.confirm.mockResolvedValue(false);

    await handleRemove(["remove", "my-repo"], tex);

    expect(ui.confirm).toHaveBeenCalled();
    expect(mockRmSync).not.toHaveBeenCalled();
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("Aborted"), "info");
  });
});

describe("handleList", () => {
  const ui = makeMockUI();

  beforeEach(() => { setHomeDirOverride(FAKE_HOME); });
  afterEach(() => { clearHomeDirOverride(); vi.restoreAllMocks(); });

  it("shows 'No plugins found.' when no repos exist", async () => {
    mockExistsSync.mockReturnValue(false);
    await handleList({ cwd: "/tmp/test", ui });
    expect(ui.notify).toHaveBeenCalledWith("No plugins found.", "info");
  });

  it("shows enabled repos in green with * prefix and disabled with - prefix", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "alpha", isDirectory: () => true },
      { name: "beta", isDirectory: () => true },
    ] as any);

    const pluginsMod = await import("../../shared/plugins.js");
    vi.spyOn(pluginsMod, "getEnabledPlugins").mockReturnValue(["alpha"]);

    await handleList({ cwd: "/tmp/test", ui });

    const msg = ui.notify.mock.calls[0][0];
    expect(msg).toContain("\x1b[32m* alpha\x1b[0m");
    expect(msg).toContain("- beta");
    expect(ui.notify.mock.calls[0][1]).toBe("info");
  });

  it("shows all as disabled when none are enabled", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "repo-a", isDirectory: () => true },
    ] as any);

    const pluginsMod = await import("../../shared/plugins.js");
    vi.spyOn(pluginsMod, "getEnabledPlugins").mockReturnValue([]);

    await handleList({ cwd: "/tmp/test", ui });

    const msg = ui.notify.mock.calls[0][0];
    expect(msg).toContain("- repo-a");
    expect(msg).not.toContain("\x1b[32m");
  });
});
