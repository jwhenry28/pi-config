import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { Skill } from "@mariozechner/pi-coding-agent";

export interface ModuleContents {
  skills: Skill[];
  tools: string[]; // tool names
}

/**
 * Parse the YAML frontmatter from a SKILL.md file and return the `module` field, if any.
 */
function extractSkillModule(filePath: string): string | undefined {
  try {
    const content = readFileSync(filePath, "utf-8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return undefined;
    const frontmatter = parseYaml(match[1]) as Record<string, unknown>;
    const hasModule = typeof frontmatter.module === "string" && frontmatter.module.length > 0;
    if (!hasModule) return undefined;
    return frontmatter.module as string;
  } catch {
    return undefined;
  }
}

/**
 * Discover all modules by scanning skills and tool tags.
 *
 * Returns a map of module name → { skills, tools }.
 * Skills and tools not assigned to any module are NOT included.
 */
export function discoverModules(allSkills: Skill[], toolModuleMap: ReadonlyMap<string, string>): Map<string, ModuleContents> {
  const modules = new Map<string, ModuleContents>();

  const ensureModule = (name: string): ModuleContents => {
    let mod = modules.get(name);
    if (mod) return mod;

    mod = { skills: [], tools: [] };
    modules.set(name, mod);
    return mod;
  };

  // Scan skills for module frontmatter
  for (const skill of allSkills) {
    const moduleName = extractSkillModule(skill.filePath);
    if (!moduleName) continue;
    ensureModule(moduleName).skills.push(skill);
  }

  // Scan tool tags collected via the event bus
  for (const [toolName, moduleName] of toolModuleMap) {
    ensureModule(moduleName).tools.push(toolName);
  }

  return modules;
}
