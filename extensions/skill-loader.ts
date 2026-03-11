import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getEnabledPlugins } from "./shared/plugins.js";
import { getPluginsDir } from "./shared/home.js";
import { getCwd } from "./shared/cwd.js";

/**
 * Get skill directory paths from all enabled plugin repos.
 * Scans ~/.pi/plugins/<name>/skills/ for directories containing SKILL.md.
 */
export function getPluginSkillPaths(cwd: string): string[] {
  const enabled = getEnabledPlugins(cwd);
  const paths: string[] = [];

  for (const name of enabled) {
    const skillsDir = join(getPluginsDir(), name, "skills");
    if (!existsSync(skillsDir)) continue;

    let entries;
    try {
      entries = readdirSync(skillsDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = join(skillsDir, entry.name);
      if (existsSync(join(skillDir, "SKILL.md"))) {
        paths.push(skillDir);
      }
    }
  }

  return paths;
}

export default function skillLoaderExtension(pi: ExtensionAPI) {
  pi.on("resources_discover", async (_event, ctx) => {
    const cwd = getCwd(ctx);
    const pluginPaths = getPluginSkillPaths(cwd);

    if (pluginPaths.length === 0) return;
    return { skillPaths: pluginPaths };
  });
}
