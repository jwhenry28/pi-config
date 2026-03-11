import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { listPluginNames, getPluginNameCompletions } from "../completions.js";
import { setHomeDirOverride, clearHomeDirOverride } from "../../shared/home.js";
import type { PathLike } from "node:fs";

const FAKE_HOME = "/tmp/fake-home";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return { ...actual, existsSync: vi.fn(), readdirSync: vi.fn() };
});

const mockExistsSync = vi.mocked(existsSync);
const mockReaddirSync = vi.mocked(readdirSync);

beforeEach(() => setHomeDirOverride(FAKE_HOME));
afterEach(() => { clearHomeDirOverride(); vi.restoreAllMocks(); });

describe("listPluginNames", () => {
  it("returns empty array if plugins dir does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    expect(listPluginNames()).toEqual([]);
  });

  it("returns directory names from plugins dir", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "repo-a", isDirectory: () => true },
      { name: "repo-b", isDirectory: () => true },
      { name: "file.txt", isDirectory: () => false },
    ] as any);
    expect(listPluginNames()).toEqual(["repo-a", "repo-b"]);
  });
});

describe("getPluginNameCompletions", () => {
  it("returns completions matching prefix", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "repo-a", isDirectory: () => true },
      { name: "repo-b", isDirectory: () => true },
    ] as any);

    const result = getPluginNameCompletions("remove", "repo-a");
    expect(result).toHaveLength(1);
    expect(result![0].value).toBe("remove repo-a");
  });

  it("returns null when no repos match", () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: "repo-a", isDirectory: () => true },
    ] as any);

    expect(getPluginNameCompletions("remove", "xyz")).toBeNull();
  });
});
