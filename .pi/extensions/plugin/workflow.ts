import { existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { PluginExecutionContext } from "./constants.js";
import { WORKFLOWS_DIR } from "../shared/paths.js";
import { getPluginsDir } from "../shared/home.js";

export async function handleWorkflowAdd(parts: string[], tex: PluginExecutionContext): Promise<void> {
  const name = parts[2];
  if (!name) {
    tex.ui.notify("Usage: /plugin workflow add <name>", "warning");
    return;
  }

  const destDir = join(tex.cwd, WORKFLOWS_DIR);
  const destFile = join(destDir, `${name}.yml`);

  if (existsSync(destFile)) {
    tex.ui.notify(`Workflow "${name}" already exists in ${WORKFLOWS_DIR}/.`, "error");
    return;
  }

  const matches = findWorkflowInRepos(name);

  if (matches.length === 0) {
    tex.ui.notify(`Workflow "${name}" not found in any plugin repo.`, "error");
    return;
  }

  if (matches.length > 1) {
    const repos = matches.map(m => m.repo).join(", ");
    tex.ui.notify(`Workflow "${name}" found in multiple repos: ${repos}. Specify which repo to use.`, "error");
    return;
  }

  mkdirSync(destDir, { recursive: true });
  copyFileSync(matches[0].filePath, destFile);
  tex.ui.notify(`Added workflow "${name}" from ${matches[0].repo}.`, "info");
}

export async function handleWorkflowRemove(parts: string[], tex: PluginExecutionContext): Promise<void> {
  const name = parts[2];
  if (!name) {
    tex.ui.notify("Usage: /plugin workflow remove <name>", "warning");
    return;
  }

  const destFile = join(tex.cwd, WORKFLOWS_DIR, `${name}.yml`);

  if (!existsSync(destFile)) {
    tex.ui.notify(`Workflow "${name}" not found in ${WORKFLOWS_DIR}/.`, "error");
    return;
  }

  unlinkSync(destFile);
  tex.ui.notify(`Removed workflow "${name}".`, "info");
}

function findWorkflowInRepos(name: string): { repo: string; filePath: string }[] {
  const pluginsDir = getPluginsDir();
  if (!existsSync(pluginsDir)) return [];

  const matches: { repo: string; filePath: string }[] = [];
  const repos = readdirSync(pluginsDir, { withFileTypes: true }).filter(d => d.isDirectory());

  for (const repo of repos) {
    const workflowsDir = join(pluginsDir, repo.name, "workflows");
    if (!existsSync(workflowsDir)) continue;

    const candidate = join(workflowsDir, `${name}.yml`);
    if (existsSync(candidate)) {
      matches.push({ repo: repo.name, filePath: candidate });
    }
  }

  return matches;
}
