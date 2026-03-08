import { describe, it, expect } from "vitest";
import { parseSubcommand, formatSetSummary, formatListOutput } from "../index.js";

describe("parseSubcommand", () => {
  it("returns empty for no args", () => {
    expect(parseSubcommand("")).toEqual({ subcommand: "", rest: "" });
  });

  it("parses subcommand only", () => {
    expect(parseSubcommand("list")).toEqual({ subcommand: "list", rest: "" });
  });

  it("parses subcommand with one arg", () => {
    expect(parseSubcommand("get smart")).toEqual({ subcommand: "get", rest: "smart" });
  });

  it("parses subcommand with multiple args", () => {
    expect(parseSubcommand("set smart claude-opus-4-6")).toEqual({ subcommand: "set", rest: "smart claude-opus-4-6" });
  });
});

describe("formatSetSummary", () => {
  it("formats set confirmation", () => {
    expect(formatSetSummary("smart", "claude-opus-4-6")).toBe("Set smart = claude-opus-4-6");
  });
});

describe("formatListOutput", () => {
  it("formats entries with current values and defaults", () => {
    const entries = [
      { name: "smart", description: "Model alias for complex tasks", default: "claude-opus-4-6", current: "anthropic/claude-opus-4-6" },
      { name: "general", description: "Model alias for standard tasks", default: "claude-sonnet-4-6", current: null },
      { name: "fast", description: "Model alias for simple tasks", default: "claude-haiku-4-5", current: null },
    ];
    const output = formatListOutput(entries);
    expect(output).toContain("smart");
    expect(output).toContain("anthropic/claude-opus-4-6");
    expect(output).toContain("default:");
  });
});
