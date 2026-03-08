import { existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BorderedLoader } from "@mariozechner/pi-coding-agent";
import { normalizeGitUrl, extractRepoName, runGit, runGitAsync } from "./git.js";
import type { PluginExecutionContext } from "./constants.js";
import { getWrappersForPlugin } from "../shared/skill-wrappers.js";
import { WRAPPER_SKILLS_DIR } from "../shared/paths.js";
import { getPluginsDir } from "../shared/home.js";

export async function handleRepoDownload(parts: string[], tex: PluginExecutionContext): Promise<void> {
  const ref = parts[2];
  if (!ref) {
    tex.ui.notify("Usage: /plugin repo download <github-url-or-org/repo> [alias]", "warning");
    return;
  }

  let url: string;
  let name: string;
  try {
    url = normalizeGitUrl(ref);
    name = parts[3] || extractRepoName(ref);
  } catch (err: unknown) {
    tex.ui.notify((err as Error).message, "error");
    return;
  }

  const pluginsDir = getPluginsDir();
  const targetDir = join(pluginsDir, name);

  if (existsSync(targetDir)) {
    tex.ui.notify(`Directory "${name}" already exists in ~/.pi/plugins/. Remove it first or use "repo update".`, "error");
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
  const hasSkillLibrary = existsSync(join(targetDir, "skill-library"));
  const hasWorkflows = existsSync(join(targetDir, "workflows"));

  if (!hasSkills && !hasSkillLibrary && !hasWorkflows) {
    rmSync(targetDir, { recursive: true, force: true });
    tex.ui.notify(`Repo "${name}" has no skills, skill-library, or workflows directory. Clone removed.`, "error");
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

    runGitAsync(["pull", "origin", "main"], dir)
      .then(() => done({ ok: true }))
      .catch((err: Error) => done({ ok: false, error: err.message }));

    return loader;
  });
}

export async function handleRepoUpdate(parts: string[], tex: PluginExecutionContext): Promise<void> {
  const name = parts[2];
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

export async function handleRepoRemove(parts: string[], tex: PluginExecutionContext): Promise<void> {
  const name = parts[2];
  if (!name) {
    tex.ui.notify("Usage: /plugin repo remove <name>", "warning");
    return;
  }

  const pluginDir = join(getPluginsDir(), name);
  if (!existsSync(pluginDir)) {
    tex.ui.notify(`Plugin directory "${name}" not found in ~/.pi/plugins/.`, "error");
    return;
  }

  let dirty = false;
  try {
    const status = runGit(["status", "--porcelain"], pluginDir);
    if (status.length > 0) dirty = true;
  } catch {
    // not a git repo or other error — skip check
  }

  if (!dirty) {
    try {
      const unpushed = runGit(["log", "@{u}..HEAD", "--oneline"], pluginDir);
      if (unpushed.length > 0) dirty = true;
    } catch {
      // no upstream configured — skip check
    }
  }

  if (dirty) {
    const confirmed = await tex.ui.confirm(
      "Uncommitted changes",
      `Repo "${name}" has uncommitted changes or unpushed commits. Delete anyway?`,
    );
    if (!confirmed) {
      tex.ui.notify("Aborted.", "info");
      return;
    }
  }

  const wrappers = getWrappersForPlugin(tex.cwd, name);
  for (const w of wrappers) {
    const wrapperDir = join(tex.cwd, WRAPPER_SKILLS_DIR, w.dirName);
    rmSync(wrapperDir, { recursive: true, force: true });
  }

  rmSync(pluginDir, { recursive: true, force: true });

  const suffix = wrappers.length > 0
    ? ` and ${wrappers.length} associated skill wrappers.`
    : ".";
  tex.ui.notify(`Removed repo "${name}"${suffix}`, "info");
}
