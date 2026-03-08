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

  it("throws when all sections are absent or empty", () => {
    expect(() => parseConfigFile("name: Test")).toThrow(
      "at least one of 'configs', 'skills', or 'workflows'",
    );
  });

  it("throws when configs is empty array and no other sections", () => {
    expect(() => parseConfigFile("name: Test\nconfigs: []")).toThrow(
      "at least one of 'configs', 'skills', or 'workflows'",
    );
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

  // Skills parsing
  it("parses skills array", () => {
    const yaml = [
      "name: WithSkills",
      "skills:",
      "  - location: my-repo/skills/foo",
      "    module: development",
      "  - location: my-repo/skills/bar",
    ].join("\n");
    const result = parseConfigFile(yaml);
    expect(result.configs).toBeUndefined();
    expect(result.skills).toEqual([
      { location: "my-repo/skills/foo", module: "development" },
      { location: "my-repo/skills/bar", module: undefined },
    ]);
  });

  it("parses workflows array", () => {
    const yaml = "name: WithWorkflows\nworkflows:\n  - location: my-repo/workflows/deploy.yml";
    const result = parseConfigFile(yaml);
    expect(result.workflows).toEqual([{ location: "my-repo/workflows/deploy.yml" }]);
  });

  it("parses all three sections together", () => {
    const yaml = [
      "name: Full",
      "configs:",
      "  - name: smart",
      "    value: claude-opus-4-6",
      "skills:",
      "  - location: repo/skills/x",
      "workflows:",
      "  - location: repo/workflows/y.yml",
    ].join("\n");
    const result = parseConfigFile(yaml);
    expect(result.configs).toHaveLength(1);
    expect(result.skills).toHaveLength(1);
    expect(result.workflows).toHaveLength(1);
  });

  it("throws when skill entry missing location", () => {
    expect(() =>
      parseConfigFile("name: Bad\nskills:\n  - module: dev"),
    ).toThrow("must have a string 'location'");
  });

  it("throws when workflow entry missing location", () => {
    expect(() =>
      parseConfigFile("name: Bad\nworkflows:\n  - foo: bar"),
    ).toThrow("must have a string 'location'");
  });

  it("throws when skills is not an array", () => {
    expect(() =>
      parseConfigFile("name: Bad\nskills: not-array"),
    ).toThrow("'skills' must be an array");
  });

  it("throws when workflows is not an array", () => {
    expect(() =>
      parseConfigFile("name: Bad\nworkflows: not-array"),
    ).toThrow("'workflows' must be an array");
  });
});
