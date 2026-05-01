import { describe, it, expect } from "vitest";
import { computeActiveTools, computeExcludedSkillNames, normalizeUserShownModules } from "../state.js";
import { UNTAGGED_MODULE } from "../api.js";
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

  it("excludes UNTAGGED tools unless explicitly appended by internal workflow code", () => {
    const modules = new Map<string, ModuleContents>([
      [UNTAGGED_MODULE, { skills: [], tools: ["pause_workflow"] }],
    ]);
    const state = { shown: [UNTAGGED_MODULE], granular: {} };

    const result = computeActiveTools(["pause_workflow", "memory_get"], modules, state);

    expect(result).toEqual(["memory_get"]);
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

  it("does not treat UNTAGGED as user-shown when excluding skills", () => {
    const modules = new Map<string, ModuleContents>([
      [UNTAGGED_MODULE, { skills: [makeSkill("internal-skill")], tools: [] }],
    ]);
    const state = { shown: [UNTAGGED_MODULE], granular: {} };

    const result = computeExcludedSkillNames(modules, state);

    expect(result).toEqual(new Set(["internal-skill"]));
  });
});

describe("normalizeUserShownModules", () => {
  it("drops unknown modules and the internal UNTAGGED module", () => {
    const modules = new Map<string, ModuleContents>([
      ["ask", { skills: [], tools: ["ask_user"] }],
      [UNTAGGED_MODULE, { skills: [], tools: ["pause_workflow"] }],
    ]);

    expect(normalizeUserShownModules(["ask", UNTAGGED_MODULE, "missing"], modules)).toEqual(["ask"]);
  });
});
