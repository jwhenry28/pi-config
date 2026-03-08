import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseFrontmatter } from "./types.js";
import { WRAPPER_SKILLS_DIR } from "./paths.js";
import { getPluginsDir } from "./home.js";

export interface WrapperInfo {
  dirName: string;
  wrapperPath: string;
  realSkillDir: string;
  realSkillFile: string;
  wrapperFrontmatter: Record<string, unknown>;
}

/**
 * Discover all WRAPPER.md files and resolve their target paths.
 *
 * @param cwd - Project root directory
 * @returns Array of resolved wrapper info
 */
export function discoverWrappers(cwd: string): WrapperInfo[] {
  const skillsDir = join(cwd, WRAPPER_SKILLS_DIR);
  if (!existsSync(skillsDir)) return [];

  let entries: string[];
  try {
    entries = readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch {
    return [];
  }

  const results: WrapperInfo[] = [];

  for (const dirName of entries) {
    const wrapperPath = join(skillsDir, dirName, "WRAPPER.md");
    if (!existsSync(wrapperPath)) continue;

    const wrapperFrontmatter = parseFrontmatter(wrapperPath);
    const symlink = wrapperFrontmatter.symlink;
    if (typeof symlink !== "string" || symlink.length === 0) continue;

    // Resolve the symlink path
    let resolvedSymlink: string;
    if (symlink.startsWith("@/")) {
      // Legacy: @ = project root
      resolvedSymlink = symlink.replace("@/", cwd + "/");
    } else if (symlink.startsWith("./") || symlink.startsWith("../") || symlink.startsWith("/")) {
      // Relative to wrapper dir or absolute
      resolvedSymlink = symlink;
    } else {
      // Bare path: relative to global plugins dir
      resolvedSymlink = join(getPluginsDir(), symlink);
    }
    const wrapperDir = join(skillsDir, dirName);
    const realSkillDir = resolve(wrapperDir, resolvedSymlink);
    const realSkillFile = join(realSkillDir, "SKILL.md");

    if (!existsSync(realSkillFile)) {
      console.warn(`[skill-wrappers] WRAPPER.md in "${dirName}" has symlink "${symlink}" but resolved path "${realSkillFile}" does not exist — skipping`);
      continue;
    }

    results.push({ dirName, wrapperPath, realSkillDir, realSkillFile, wrapperFrontmatter });
  }

  return results;
}

/**
 * Get the real skill directory paths from all wrappers.
 * Used to feed into pi's resources_discover for /skill:name support.
 */
export function getWrapperSkillPaths(cwd: string): string[] {
  return discoverWrappers(cwd).map(w => w.realSkillDir);
}

/**
 * Get all wrappers that point into a specific plugin's directory.
 */
export function getWrappersForPlugin(cwd: string, pluginName: string): WrapperInfo[] {
  const pluginPrefix = join(getPluginsDir(), pluginName) + "/";
  return discoverWrappers(cwd).filter(w => w.realSkillDir.startsWith(pluginPrefix));
}

