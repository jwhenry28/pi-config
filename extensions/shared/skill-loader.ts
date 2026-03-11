import { loadSkills } from "@mariozechner/pi-coding-agent";
import { parseFrontmatter, type ResolvedSkill } from "./types.js";
import { getPluginSkillPaths } from "../skill-loader.js";

/**
 * Load all skills: standard pi discovery + plugin skill directories.
 *
 * Every returned skill has parsed frontmatter attached.
 *
 * @param cwd - Project root directory
 * @returns Array of ResolvedSkill with frontmatter always populated
 */
export function loadAllSkills(cwd: string): ResolvedSkill[] {
  const pluginSkillDirs = getPluginSkillPaths(cwd);
  const result = loadSkills({ cwd, skillPaths: pluginSkillDirs });

  return result.skills.map(skill => {
    const frontmatter = parseFrontmatter(skill.filePath);
    return { ...skill, frontmatter };
  });
}
