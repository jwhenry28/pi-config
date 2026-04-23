import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getEnabledPlugins } from "./shared/plugins.js";
import { getPluginsDir } from "./shared/home.js";
import { getCwd } from "./shared/cwd.js";

/**
 * Get skill directory paths from all enabled plugin repos.
 * Scans ~/.pi/plugins/<name>/skills/ for directories containing SKILL.md,
 * and ~/.pi/plugins/<name>/skill-library/ recursively for SKILL.md files.
 */
export function getPluginSkillPaths(cwd: string): string[] {
  const enabled = getEnabledPlugins(cwd);
  const paths: string[] = [];

  for (const name of enabled) {
    // Scan skills/ directory (flat, one level)
    const skillsDir = join(getPluginsDir(), name, "skills");
    if (existsSync(skillsDir)) {
      let entries;
      try {
        entries = readdirSync(skillsDir, { withFileTypes: true });
      } catch {
        entries = [];
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillDir = join(skillsDir, entry.name);
        if (existsSync(join(skillDir, "SKILL.md"))) {
          paths.push(skillDir);
        }
      }
    }

    // Also scan skill-library/ recursively
    const skillLibDir = join(getPluginsDir(), name, "skill-library");
    if (existsSync(skillLibDir)) {
      paths.push(...findSkillsRecursively(skillLibDir));
    }
  }

  return paths;
}

/**
 * Recursively walk a directory tree, collecting paths of directories that contain SKILL.md.
 */
function findSkillsRecursively(dir: string): string[] {
  const results: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = join(dir, entry.name);
    if (existsSync(join(fullPath, "SKILL.md"))) {
      results.push(fullPath);
    }
    results.push(...findSkillsRecursively(fullPath));
  }
  return results;
}

export default function skillLoaderExtension(pi: ExtensionAPI) {
  pi.on("resources_discover", async (_event, ctx) => {
    const cwd = getCwd(ctx);
    const pluginPaths = getPluginSkillPaths(cwd);

    if (pluginPaths.length === 0) return;
    return {
      skillPaths: pluginPaths,
      promptPaths: [],
      themePaths: [],
    };
  });
}
