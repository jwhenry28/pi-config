import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { WRAPPER_SKILLS_DIR, WORKFLOWS_DIR } from "../shared/paths.js";
import { getPluginsDir } from "../shared/home.js";

/**
 * List directory names inside ~/.pi/plugins/.
 */
export function listPluginRepos(): string[] {
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
 * List wrapper skill names (directories in .pi-config/skills/ that contain WRAPPER.md).
 */
export function listWrapperSkills(cwd: string): string[] {
  const skillsDir = join(cwd, WRAPPER_SKILLS_DIR);
  if (!existsSync(skillsDir)) return [];
  try {
    return readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && existsSync(join(skillsDir, d.name, "WRAPPER.md")))
      .map(d => d.name);
  } catch {
    return [];
  }
}

/**
 * Generate completions for repo names, prefixed with a subcommand.
 */
export function getRepoNameCompletions(subcommand: string, prefix: string): AutocompleteItem[] | null {
  const repos = listPluginRepos();
  const filtered = repos.filter(r => r.startsWith(prefix));
  return filtered.length > 0
    ? filtered.map(r => ({ value: `repo ${subcommand} ${r}`, label: r }))
    : null;
}

/**
 * Generate completions for wrapper skill names, prefixed with a subcommand.
 */
export function getWrapperSkillCompletions(subcommand: string, prefix: string, cwd: string): AutocompleteItem[] | null {
  const skills = listWrapperSkills(cwd);
  const filtered = skills.filter(s => s.startsWith(prefix));
  return filtered.length > 0
    ? filtered.map(s => ({ value: `skill ${subcommand} ${s}`, label: s }))
    : null;
}

/**
 * Recursively find all directories containing SKILL.md under a given root.
 * Returns paths relative to `baseDir`.
 */
function findSkillPaths(baseDir: string, dir: string): string[] {
  const results: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (existsSync(join(full, "SKILL.md"))) {
      results.push(relative(baseDir, full));
    } else {
      results.push(...findSkillPaths(baseDir, full));
    }
  }
  return results;
}

/**
 * Skill-add completions: fuzzy-search all skill directories across all plugin repos.
 *
 * Searches `skills/` and `skill-library/` inside each repo under `.pi-config/plugins/`,
 * and filters by whether the skill path contains the search prefix.
 */
export function getSkillAddPathCompletions(prefix: string): AutocompleteItem[] | null {
  const pluginsDir = getPluginsDir();
  if (!existsSync(pluginsDir)) return null;

  const repos = readdirSync(pluginsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const allPaths: string[] = [];
  for (const repo of repos) {
    const repoDir = join(pluginsDir, repo);
    for (const sub of ["skills", "skill-library"]) {
      const subDir = join(repoDir, sub);
      if (!existsSync(subDir)) continue;
      for (const skillRel of findSkillPaths(subDir, subDir)) {
        allPaths.push(`${repo}/${sub}/${skillRel}`);
      }
    }
  }

  const query = prefix.toLowerCase();
  const filtered = allPaths.filter(p => p.toLowerCase().includes(query));
  if (filtered.length === 0) return null;

  // Sort: prefer paths where the last segment starts with the query
  filtered.sort((a, b) => {
    const aName = a.split("/").pop()!;
    const bName = b.split("/").pop()!;
    const aStarts = aName.toLowerCase().startsWith(query) ? 0 : 1;
    const bStarts = bName.toLowerCase().startsWith(query) ? 0 : 1;
    return aStarts - bStarts || a.localeCompare(b);
  });

  return filtered.map(p => {
    const skillName = p.split("/").pop()!;
    return {
      value: `skill add ${p}`,
      label: `${skillName}`,
      description: p,
    };
  });
}

/**
 * Completions for `workflow add`: scan all plugin repos' workflows/ for .yml files.
 */
export function getWorkflowAddCompletions(prefix: string): AutocompleteItem[] | null {
  const pluginsDir = getPluginsDir();
  if (!existsSync(pluginsDir)) return null;

  const repos = readdirSync(pluginsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const items: AutocompleteItem[] = [];
  for (const repo of repos) {
    const workflowsDir = join(pluginsDir, repo, "workflows");
    if (!existsSync(workflowsDir)) continue;

    let entries;
    try {
      entries = readdirSync(workflowsDir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.endsWith(".yml")) continue;
      const name = entry.replace(/\.yml$/, "");
      const isMatch = name.startsWith(prefix) || name.toLowerCase().includes(prefix.toLowerCase());
      if (!isMatch) continue;

      items.push({
        value: `workflow add ${name}`,
        label: name,
        description: repo,
      });
    }
  }

  return items.length > 0 ? items : null;
}

/**
 * Completions for `workflow remove`: list .yml files in .pi-config/workflows/.
 */
export function getLocalWorkflowCompletions(prefix: string, cwd: string): AutocompleteItem[] | null {
  const workflowsDir = join(cwd, WORKFLOWS_DIR);
  if (!existsSync(workflowsDir)) return null;

  let entries;
  try {
    entries = readdirSync(workflowsDir);
  } catch {
    return null;
  }

  const items: AutocompleteItem[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".yml")) continue;
    const name = entry.replace(/\.yml$/, "");
    if (!name.startsWith(prefix)) continue;

    items.push({
      value: `workflow remove ${name}`,
      label: name,
    });
  }

  return items.length > 0 ? items : null;
}
