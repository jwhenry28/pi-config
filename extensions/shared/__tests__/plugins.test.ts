import { describe, it, expect, afterEach } from "vitest";
import { getEnabledPlugins, setEnabledPlugins } from "../plugins.js";
import { purgeStore } from "../../testutils/index.js";

const cwd = process.cwd();

describe("plugins helper", () => {
  afterEach(() => {
    purgeStore(cwd, "pi-config");
  });

  it("returns empty array when no state exists", () => {
    const result = getEnabledPlugins(cwd);
    expect(result).toEqual([]);
  });

  it("round-trips enabled plugins", () => {
    setEnabledPlugins(cwd, ["repo-a", "repo-b"]);
    const result = getEnabledPlugins(cwd);
    expect(result).toEqual(["repo-a", "repo-b"]);
  });

  it("overwrites previous state", () => {
    setEnabledPlugins(cwd, ["repo-a"]);
    setEnabledPlugins(cwd, ["repo-b"]);
    expect(getEnabledPlugins(cwd)).toEqual(["repo-b"]);
  });

  it("handles empty enable list", () => {
    setEnabledPlugins(cwd, ["repo-a"]);
    setEnabledPlugins(cwd, []);
    expect(getEnabledPlugins(cwd)).toEqual([]);
  });
});
