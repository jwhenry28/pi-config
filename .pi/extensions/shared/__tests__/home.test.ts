import { describe, it, expect, afterEach } from "vitest";
import { getHomeDir, setHomeDirOverride, clearHomeDirOverride, getPluginsDir } from "../home.js";
import { homedir } from "node:os";
import { join } from "node:path";

describe("home", () => {
  afterEach(() => {
    clearHomeDirOverride();
  });

  it("returns os.homedir() by default", () => {
    expect(getHomeDir()).toBe(homedir());
  });

  it("returns override when set", () => {
    setHomeDirOverride("/tmp/fake-home");
    expect(getHomeDir()).toBe("/tmp/fake-home");
  });

  it("reverts after clear", () => {
    setHomeDirOverride("/tmp/fake-home");
    clearHomeDirOverride();
    expect(getHomeDir()).toBe(homedir());
  });

  it("getPluginsDir returns ~/.pi/plugins", () => {
    expect(getPluginsDir()).toBe(join(homedir(), ".pi", "plugins"));
  });

  it("getPluginsDir respects override", () => {
    setHomeDirOverride("/tmp/fake-home");
    expect(getPluginsDir()).toBe("/tmp/fake-home/.pi/plugins");
  });
});
