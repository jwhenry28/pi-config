import { describe, it, expect } from "vitest";
import { buildStartupModuleList } from "../header.js";
import { UNTAGGED_MODULE } from "../modules/api.js";
import type { ModuleContents } from "../modules/registry.js";

describe("buildStartupModuleList", () => {
  it("omits the internal UNTAGGED module from the startup header", () => {
    const modules = new Map<string, ModuleContents>([
      [UNTAGGED_MODULE, { skills: [], tools: ["pause_workflow"] }],
      ["ask", { skills: [], tools: ["ask_user"] }],
      ["web", { skills: [], tools: ["web_fetch"] }],
    ]);

    const result = buildStartupModuleList(modules, [UNTAGGED_MODULE, "web"]);

    expect(result).toEqual([
      { name: "ask", shown: false },
      { name: "web", shown: true },
    ]);
  });
});
