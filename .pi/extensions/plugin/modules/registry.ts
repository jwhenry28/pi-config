import type { ResolvedSkill } from "../../shared/types.js";

export interface ModuleContents {
  skills: ResolvedSkill[];
  tools: string[];
}

/**
 * Discover all modules by scanning skills and tool tags.
 *
 * Returns a map of module name → { skills, tools }.
 * Skills and tools not assigned to any module are NOT included.
 */
export function discoverModules(allSkills: ResolvedSkill[], toolModuleMap: ReadonlyMap<string, string>): Map<string, ModuleContents> {
  const modules = new Map<string, ModuleContents>();

  const ensureModule = (name: string): ModuleContents => {
    let mod = modules.get(name);
    if (mod) return mod;

    mod = { skills: [], tools: [] };
    modules.set(name, mod);
    return mod;
  };

  // Read module from pre-parsed frontmatter
  for (const skill of allSkills) {
    const moduleName = skill.frontmatter.module;
    if (typeof moduleName !== "string" || moduleName.length === 0) continue;
    ensureModule(moduleName).skills.push(skill);
  }

  // Scan tool tags collected via the event bus
  for (const [toolName, moduleName] of toolModuleMap) {
    ensureModule(moduleName).tools.push(toolName);
  }

  return modules;
}
