import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { handleEnable, handleDisable } from "../handlers.js";
import { setHomeDirOverride, clearHomeDirOverride, getPluginsDir } from "../../shared/home.js";
import { writeGlobalPluginDir } from "../../testutils/fixtures.js";
import { getEnabledPlugins, setEnabledPlugins } from "../../shared/plugins.js";
import { purgeStore } from "../../testutils/index.js";
import type { PluginUI } from "../constants.js";

const cwd = process.cwd();
let tmpHome: string;

function makeMockUI(): PluginUI & { notify: ReturnType<typeof vi.fn>; confirm: ReturnType<typeof vi.fn>; custom: ReturnType<typeof vi.fn> } {
  return { notify: vi.fn(), confirm: vi.fn(), custom: vi.fn() };
}

describe("handleEnable", () => {
  const ui = makeMockUI();

  beforeEach(() => {
    tmpHome = join(cwd, ".test-home-" + Date.now());
    mkdirSync(tmpHome, { recursive: true });
    setHomeDirOverride(tmpHome);
  });

  afterEach(() => {
    clearHomeDirOverride();
    purgeStore(cwd, "pi-config");
    if (existsSync(tmpHome)) rmSync(tmpHome, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("enables a downloaded plugin", async () => {
    writeGlobalPluginDir("test-repo");

    await handleEnable(["enable", "test-repo"], { cwd, ui });

    expect(getEnabledPlugins(cwd)).toContain("test-repo");
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("Enabled"), "info");
  });

  it("errors when plugin dir does not exist", async () => {
    await handleEnable(["enable", "nonexistent"], { cwd, ui });
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("not found"), "error");
  });

  it("warns when plugin is already enabled", async () => {
    writeGlobalPluginDir("test-repo");
    setEnabledPlugins(cwd, ["test-repo"]);

    await handleEnable(["enable", "test-repo"], { cwd, ui });
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("already enabled"), "warning");
  });

  it("errors on missing name argument", async () => {
    await handleEnable(["enable"], { cwd, ui });
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("Usage"), "warning");
  });
});

describe("handleDisable", () => {
  const ui = makeMockUI();

  beforeEach(() => {
    tmpHome = join(cwd, ".test-home-" + Date.now());
    mkdirSync(tmpHome, { recursive: true });
    setHomeDirOverride(tmpHome);
  });

  afterEach(() => {
    clearHomeDirOverride();
    purgeStore(cwd, "pi-config");
    if (existsSync(tmpHome)) rmSync(tmpHome, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("disables an enabled plugin", async () => {
    setEnabledPlugins(cwd, ["test-repo"]);

    await handleDisable(["disable", "test-repo"], { cwd, ui });

    expect(getEnabledPlugins(cwd)).not.toContain("test-repo");
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("Disabled"), "info");
  });

  it("warns when plugin is not enabled", async () => {
    await handleDisable(["disable", "nonexistent"], { cwd, ui });
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("not enabled"), "warning");
  });

  it("errors on missing name argument", async () => {
    await handleDisable(["disable"], { cwd, ui });
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("Usage"), "warning");
  });
});
