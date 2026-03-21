import { existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BorderedLoader } from "@mariozechner/pi-coding-agent";
import { normalizeGitUrl, extractRepoName, runGit, runGitAsync, getCurrentBranch } from "./git.js";
import type { PluginExecutionContext } from "./constants.js";
import { getPluginsDir } from "../shared/home.js";
import { getEnabledPlugins, setEnabledPlugins } from "../shared/plugins.js";
import { listPluginNames } from "./completions.js";

export async function handleDownload(parts: string[], tex: PluginExecutionContext): Promise<void> {
  const ref = parts[1];
  if (!ref) {
    tex.ui.notify("Usage: /plugin download <github-url-or-org/repo> [alias]", "warning");
    return;
  }

  let url: string;
  let name: string;
  try {
    url = normalizeGitUrl(ref);
    name = parts[2] || extractRepoName(ref);
  } catch (err: unknown) {
    tex.ui.notify((err as Error).message, "error");
    return;
  }

  const pluginsDir = getPluginsDir();
  const targetDir = join(pluginsDir, name);

  if (existsSync(targetDir)) {
    tex.ui.notify(`Directory "${name}" already exists in ~/.pi/plugins/. Remove it first or use "update".`, "error");
    return;
  }

  mkdirSync(pluginsDir, { recursive: true });

  const cloneResult = await tex.ui.custom<{ ok: boolean; error?: string }>((tui, theme, _kb, done) => {
    const loader = new BorderedLoader(tui, theme, `Cloning ${name}…`);
    loader.onAbort = () => done({ ok: false, error: "Aborted" });

    runGitAsync(["clone", "--depth", "1", url, targetDir], tex.cwd)
      .then(() => done({ ok: true }))
      .catch((err: Error) => done({ ok: false, error: err.message }));

    return loader;
  });

  if (!cloneResult.ok) {
    tex.ui.notify(
      cloneResult.error === "Aborted"
        ? "Clone aborted."
        : `Git clone failed (repo may not exist or you lack access): ${cloneResult.error}`,
      "error",
    );
    return;
  }

  const hasSkills = existsSync(join(targetDir, "skills"));
  const hasWorkflows = existsSync(join(targetDir, "workflows"));

  if (!hasSkills && !hasWorkflows) {
    rmSync(targetDir, { recursive: true, force: true });
    tex.ui.notify(`Repo "${name}" has no skills/ or workflows/ directory. Clone removed.`, "error");
    return;
  }

  tex.ui.notify(`Downloaded repo "${name}" into ~/.pi/plugins/.`, "info");
}

async function pullWithLoader(
  name: string,
  dir: string,
  tex: PluginExecutionContext,
): Promise<{ ok: boolean; error?: string }> {
  return tex.ui.custom<{ ok: boolean; error?: string }>((tui, theme, _kb, done) => {
    const loader = new BorderedLoader(tui, theme, `Updating ${name}…`);
    loader.onAbort = () => done({ ok: false, error: "Aborted" });

    const branch = getCurrentBranch(dir);

    runGitAsync(["pull", "origin", branch], dir)
      .then(() => done({ ok: true }))
      .catch((err: Error) => done({ ok: false, error: err.message }));

    return loader;
  });
}

export async function handleUpdate(parts: string[], tex: PluginExecutionContext): Promise<void> {
  const name = parts[1];
  const pluginsDir = getPluginsDir();

  if (!name) {
    if (!existsSync(pluginsDir)) {
      tex.ui.notify("No plugins found.", "info");
      return;
    }

    const entries = readdirSync(pluginsDir);
    if (entries.length === 0) {
      tex.ui.notify("No plugins found.", "info");
      return;
    }

    let updated = 0;

    for (const entry of entries) {
      const dir = join(pluginsDir, entry);
      const result = await pullWithLoader(entry, dir, tex);
      if (result.ok) {
        updated++;
      } else if (result.error !== "Aborted") {
        tex.ui.notify(`Failed to update "${entry}": ${result.error}`, "warning");
      }
    }

    tex.ui.notify(`Updated ${updated} of ${entries.length} plugins.`, "info");
    return;
  }

  const pluginDir = join(pluginsDir, name);
  if (!existsSync(pluginDir)) {
    tex.ui.notify(`Plugin directory "${name}" not found in ~/.pi/plugins/.`, "error");
    return;
  }

  const result = await pullWithLoader(name, pluginDir, tex);
  if (result.ok) {
    tex.ui.notify(`Updated plugin "${name}" to latest.`, "info");
  } else {
    tex.ui.notify(
      result.error === "Aborted" ? "Update aborted." : `Git error: ${result.error}`,
      "error",
    );
  }
}

function hasUncommittedChanges(pluginDir: string): boolean {
  try {
    const status = runGit(["status", "--porcelain"], pluginDir);
    if (status.length > 0) return true;
  } catch {
    // not a git repo or other error — skip check
  }

  try {
    const unpushed = runGit(["log", "@{u}..HEAD", "--oneline"], pluginDir);
    if (unpushed.length > 0) return true;
  } catch {
    // no upstream configured — skip check
  }

  return false;
}

export async function handleRemove(parts: string[], tex: PluginExecutionContext): Promise<void> {
  const name = parts[1];
  if (!name) {
    tex.ui.notify("Usage: /plugin remove <name>", "warning");
    return;
  }

  const pluginDir = join(getPluginsDir(), name);
  if (!existsSync(pluginDir)) {
    tex.ui.notify(`Plugin directory "${name}" not found in ~/.pi/plugins/.`, "error");
    return;
  }

  if (hasUncommittedChanges(pluginDir)) {
    const confirmed = await tex.ui.confirm(
      "Uncommitted changes",
      `Repo "${name}" has uncommitted changes or unpushed commits. Delete anyway?`,
    );
    if (!confirmed) {
      tex.ui.notify("Aborted.", "info");
      return;
    }
  }

  // Remove from enabled list if present
  const enabled = getEnabledPlugins(tex.cwd);
  const enabledIdx = enabled.indexOf(name);
  if (enabledIdx !== -1) {
    enabled.splice(enabledIdx, 1);
    setEnabledPlugins(tex.cwd, enabled);
  }

  rmSync(pluginDir, { recursive: true, force: true });
  tex.ui.notify(`Removed repo "${name}".`, "info");
}

export async function handleEnable(parts: string[], tex: PluginExecutionContext): Promise<void> {
  const name = parts[1];
  if (!name) {
    tex.ui.notify("Usage: /plugin enable <name>", "warning");
    return;
  }

  const pluginDir = join(getPluginsDir(), name);
  if (!existsSync(pluginDir)) {
    tex.ui.notify(`Plugin "${name}" not found in ~/.pi/plugins/. Download it first.`, "error");
    return;
  }

  const enabled = getEnabledPlugins(tex.cwd);
  if (enabled.includes(name)) {
    tex.ui.notify(`Plugin "${name}" is already enabled.`, "warning");
    return;
  }

  enabled.push(name);
  setEnabledPlugins(tex.cwd, enabled);
  tex.ui.notify(`Enabled plugin "${name}". Reload to activate its skills and workflows.`, "info");

  if (tex.reload) {
    tex.ui.notify("Reloading...", "info");
    await tex.reload();
  }
}

export async function handleDisable(parts: string[], tex: PluginExecutionContext): Promise<void> {
  const name = parts[1];
  if (!name) {
    tex.ui.notify("Usage: /plugin disable <name>", "warning");
    return;
  }

  const enabled = getEnabledPlugins(tex.cwd);
  const idx = enabled.indexOf(name);
  if (idx === -1) {
    tex.ui.notify(`Plugin "${name}" is not enabled.`, "warning");
    return;
  }

  enabled.splice(idx, 1);
  setEnabledPlugins(tex.cwd, enabled);
  tex.ui.notify(`Disabled plugin "${name}". Reload to deactivate its skills and workflows.`, "info");

  if (tex.reload) {
    tex.ui.notify("Reloading...", "info");
    await tex.reload();
  }
}

export async function handleCheckout(parts: string[], tex: PluginExecutionContext): Promise<void> {
  const name = parts[1];
  const branch = parts[2];
  if (!name || !branch) {
    tex.ui.notify("Usage: /plugin checkout <name> <branch>", "warning");
    return;
  }

  const pluginDir = join(getPluginsDir(), name);
  if (!existsSync(pluginDir)) {
    tex.ui.notify(`Plugin directory "${name}" not found in ~/.pi/plugins/.`, "error");
    return;
  }

  if (hasUncommittedChanges(pluginDir)) {
    const confirmed = await tex.ui.confirm(
      "Uncommitted changes",
      `Plugin "${name}" has uncommitted changes or unpushed commits. Switch branch anyway?`,
    );
    if (!confirmed) {
      tex.ui.notify("Aborted.", "info");
      return;
    }
  }

  const oldBranch = getCurrentBranch(pluginDir);

  const fetchResult = await tex.ui.custom<{ ok: boolean; error?: string }>((tui, theme, _kb, done) => {
    const loader = new BorderedLoader(tui, theme, `Fetching branch "${branch}"…`);
    loader.onAbort = () => done({ ok: false, error: "Aborted" });

    runGitAsync(["fetch", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`, "--depth", "1"], pluginDir)
      .then(() => done({ ok: true }))
      .catch((err: Error) => done({ ok: false, error: err.message }));

    return loader;
  });

  if (!fetchResult.ok) {
    tex.ui.notify(
      fetchResult.error === "Aborted"
        ? "Fetch aborted."
        : `Failed to fetch branch "${branch}": ${fetchResult.error}`,
      "error",
    );
    return;
  }

  try {
    runGit(["checkout", "-B", branch, `origin/${branch}`], pluginDir);
  } catch (err: unknown) {
    tex.ui.notify(`Failed to checkout branch "${branch}": ${(err as Error).message}`, "error");
    return;
  }

  tex.ui.notify(`Switched plugin "${name}" from ${oldBranch} to ${branch}.`, "info");

  if (tex.reload) {
    tex.ui.notify("Reloading...", "info");
    await tex.reload();
  }
}

export async function handleList(tex: PluginExecutionContext): Promise<void> {
  const repos = listPluginNames();
  if (repos.length === 0) {
    tex.ui.notify("No plugins found.", "info");
    return;
  }

  const enabled = new Set(getEnabledPlugins(tex.cwd));
  const lines = repos.map((name) =>
    enabled.has(name) ? `\x1b[32m* ${name}\x1b[0m` : `- ${name}`
  );
  tex.ui.notify(lines.join("\n"), "info");
}
