import { loadSkills } from "@mariozechner/pi-coding-agent";
import { parseFrontmatter, type ResolvedSkill } from "./types.js";
import { discoverWrappers } from "./skill-wrappers.js";

/**
 * Load all skills: standard pi discovery (which includes wrapper targets
 * via resources_discover) + merged wrapper frontmatter.
 *
 * Every returned skill has parsed frontmatter attached.
 * For wrapper skills, frontmatter is merged (wrapper overrides win).
 *
 * @param cwd - Project root directory
 * @returns Array of ResolvedSkill with frontmatter always populated
 */
export function loadAllSkills(cwd: string): ResolvedSkill[] {
  // 1. Discover wrappers first so we can pass their target dirs to loadSkills
  const wrappers = discoverWrappers(cwd);

  // 2. Standard pi skill discovery + wrapper target directories
  const result = loadSkills({ cwd, skillPaths: wrappers.map(w => w.realSkillDir) });

  // 3. Build a map of wrapper overrides keyed by real skill file path
  const wrapperOverridesByPath = new Map<string, Record<string, unknown>>();
  for (const w of wrappers) {
    const { symlink: _removed, ...overrides } = w.wrapperFrontmatter;
    wrapperOverridesByPath.set(w.realSkillFile, overrides);
  }

  // 4. Promote all skills to ResolvedSkill, merging wrapper overrides where applicable
  return result.skills.map(skill => {
    const baseFrontmatter = parseFrontmatter(skill.filePath);
    const overrides = wrapperOverridesByPath.get(skill.filePath);
    const frontmatter = overrides ? { ...baseFrontmatter, ...overrides } : baseFrontmatter;

    return { ...skill, frontmatter };
  });
}
