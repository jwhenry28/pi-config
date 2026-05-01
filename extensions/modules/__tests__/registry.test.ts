import { describe, it, expect } from "vitest";
import { discoverModules } from "../registry.js";
import { UNTAGGED_MODULE } from "../api.js";
import type { ResolvedSkill } from "../../shared/types.js";

function makeSkill(name: string, module?: string): ResolvedSkill {
  return {
    name,
    description: "",
    location: "",
    content: "",
    frontmatter: module ? { module } : {},
  } as ResolvedSkill;
}

describe("discoverModules", () => {
  it("groups skills and tools by module name", () => {
    const skills = [makeSkill("s1", "design"), makeSkill("s2", "design"), makeSkill("s3", "dev")];
    const toolMap = new Map([["tool-1", "design"], ["tool-2", "dev"]]);
    const result = discoverModules(skills, toolMap);

    expect(result.get("design")!.skills.map(s => s.name)).toEqual(["s1", "s2"]);
    expect(result.get("design")!.tools).toEqual(["tool-1"]);
    expect(result.get("dev")!.skills.map(s => s.name)).toEqual(["s3"]);
    expect(result.get("dev")!.tools).toEqual(["tool-2"]);
  });

  it("ignores skills without module frontmatter", () => {
    const skills = [makeSkill("s1"), makeSkill("s2", "mod-a")];
    const result = discoverModules(skills, new Map());
    expect(result.size).toBe(1);
    expect(result.has("mod-a")).toBe(true);
  });

  it("keeps UNTAGGED tools internally associated with the hidden module", () => {
    const toolMap = new Map([["pause_workflow", UNTAGGED_MODULE]]);
    const result = discoverModules([], toolMap);

    expect(result.has(UNTAGGED_MODULE)).toBe(true);
    expect(result.get(UNTAGGED_MODULE)!.tools).toEqual(["pause_workflow"]);
  });
});
