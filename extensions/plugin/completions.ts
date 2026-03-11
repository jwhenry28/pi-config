import { existsSync, readdirSync } from "node:fs";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { getPluginsDir } from "../shared/home.js";
import { getEnabledPlugins } from "../shared/plugins.js";

/**
 * List directory names inside ~/.pi/plugins/.
 */
export function listPluginNames(): string[] {
  const pluginsDir = getPluginsDir();
  if (!existsSync(pluginsDir)) return [];
  try {
    return readdirSync(pluginsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch {
    return [];
  }
}

/**
 * Generate completions for repo names, filtered by subcommand context.
 * - enable: only show disabled repos
 * - disable: only show enabled repos
 * - other subcommands: show all repos
 */
export function getPluginNameCompletions(subcommand: string, prefix: string, cwd?: string): AutocompleteItem[] | null {
  let repos = listPluginNames();

  if (cwd && (subcommand === "enable" || subcommand === "disable")) {
    const enabled = new Set(getEnabledPlugins(cwd));
    repos = subcommand === "enable"
      ? repos.filter(r => !enabled.has(r))
      : repos.filter(r => enabled.has(r));
  }

  const filtered = repos.filter(r => r.startsWith(prefix));
  return filtered.length > 0
    ? filtered.map(r => ({ value: `${subcommand} ${r}`, label: r }))
    : null;
}
