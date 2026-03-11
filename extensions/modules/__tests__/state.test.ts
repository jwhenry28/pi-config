import { describe, it, expect } from "vitest";
import { computeActiveTools, computeExcludedSkillNames } from "../state.js";
import type { ModuleContents } from "../registry.js";
import type { ResolvedSkill } from "../../shared/types.js";

function makeSkill(name: string): ResolvedSkill {
  return { name, description: "", location: "", content: "", frontmatter: {} } as ResolvedSkill;
}

describe("computeActiveTools", () => {
  it("includes tools from shown modules and untagged tools", () => {
    const modules = new Map<string, ModuleContents>([
      ["mod-a", { skills: [], tools: ["tool-a1", "tool-a2"] }],
      ["mod-b", { skills: [], tools: ["tool-b1"] }],
    ]);
    const state = { shown: ["mod-a"], granular: {} };
    const result = computeActiveTools(["tool-a1", "tool-a2", "tool-b1", "untagged"], modules, state);
    expect(result).toEqual(["tool-a1", "tool-a2", "untagged"]);
  });

  it("returns all tools when modules map is empty", () => {
    const modules = new Map<string, ModuleContents>();
    const state = { shown: [], granular: {} };
    const result = computeActiveTools(["tool-1", "tool-2"], modules, state);
    expect(result).toEqual(["tool-1", "tool-2"]);
  });

  it("excludes all module tools when none are shown", () => {
    const modules = new Map<string, ModuleContents>([
      ["mod-a", { skills: [], tools: ["tool-a"] }],
    ]);
    const state = { shown: [], granular: {} };
    const result = computeActiveTools(["tool-a", "untagged"], modules, state);
    expect(result).toEqual(["untagged"]);
  });
});

describe("computeExcludedSkillNames", () => {
  it("excludes skills from hidden modules", () => {
    const modules = new Map<string, ModuleContents>([
      ["mod-a", { skills: [makeSkill("skill-a")], tools: [] }],
      ["mod-b", { skills: [makeSkill("skill-b")], tools: [] }],
    ]);
    const state = { shown: ["mod-a"], granular: {} };
    const result = computeExcludedSkillNames(modules, state);
    expect(result).toEqual(new Set(["skill-b"]));
  });

  it("excludes all module skills when nothing is shown", () => {
    const modules = new Map<string, ModuleContents>([
      ["mod-a", { skills: [makeSkill("skill-a")], tools: [] }],
    ]);
    const state = { shown: [], granular: {} };
    const result = computeExcludedSkillNames(modules, state);
    expect(result).toEqual(new Set(["skill-a"]));
  });

  it("returns empty set when all modules shown", () => {
    const modules = new Map<string, ModuleContents>([
      ["mod-a", { skills: [makeSkill("skill-a")], tools: [] }],
    ]);
    const state = { shown: ["mod-a"], granular: {} };
    const result = computeExcludedSkillNames(modules, state);
    expect(result).toEqual(new Set());
  });
});
