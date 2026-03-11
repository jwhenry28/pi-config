import { describe, it, expect } from "vitest";
import { parseConfigFile } from "../schema.js";

describe("parseConfigFile", () => {
  it("parses a valid config file", () => {
    const yaml = [
      "name: Test",
      "description: A test config",
      "configs:",
      "  - name: smart",
      "    value: claude-opus-4-6",
      "  - name: fast",
      "    value: claude-haiku-4-5",
    ].join("\n");

    const result = parseConfigFile(yaml);
    expect(result.name).toBe("Test");
    expect(result.description).toBe("A test config");
    expect(result.configs).toEqual([
      { name: "smart", value: "claude-opus-4-6" },
      { name: "fast", value: "claude-haiku-4-5" },
    ]);
  });

  it("parses without description", () => {
    const yaml = "name: Minimal\nconfigs:\n  - name: smart\n    value: model-a";
    const result = parseConfigFile(yaml);
    expect(result.description).toBeUndefined();
    expect(result.configs).toHaveLength(1);
  });

  it("throws when YAML is not an object", () => {
    expect(() => parseConfigFile("just a string")).toThrow("must parse to an object");
  });

  it("throws when name is missing", () => {
    expect(() => parseConfigFile("configs:\n  - name: a\n    value: b")).toThrow("non-empty string 'name'");
  });

  it("throws when name is empty", () => {
    expect(() => parseConfigFile('name: ""\nconfigs:\n  - name: a\n    value: b')).toThrow("non-empty string 'name'");
  });

  it("throws when configs section is missing", () => {
    expect(() => parseConfigFile("name: Test")).toThrow("must include 'configs' with at least one entry");
  });

  it("throws when configs is empty array", () => {
    expect(() => parseConfigFile("name: Test\nconfigs: []")).toThrow("must include 'configs' with at least one entry");
  });

  it("throws when configs is not an array", () => {
    expect(() => parseConfigFile("name: Test\nconfigs: not-array")).toThrow("'configs' must be an array");
  });

  it("throws when config entry missing name", () => {
    expect(() => parseConfigFile("name: Test\nconfigs:\n  - value: x")).toThrow("must have a string 'name'");
  });

  it("throws when config entry missing value", () => {
    expect(() => parseConfigFile("name: Test\nconfigs:\n  - name: smart")).toThrow("must have a string 'value'");
  });

  it("throws when description is not a string", () => {
    expect(() => parseConfigFile("name: Test\ndescription: 123\nconfigs:\n  - name: a\n    value: b")).toThrow(
      "'description' must be a string",
    );
  });
});
