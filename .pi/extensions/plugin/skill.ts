import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateSkillTarget, createWrapper, removeWrapper } from "./wrapper.js";
import type { PluginExecutionContext } from "./constants.js";
import { WRAPPER_SKILLS_DIR } from "../shared/paths.js";
import { getPluginsDir } from "../shared/home.js";

export async function handleSkillAdd(parts: string[], tex: PluginExecutionContext): Promise<void> {
  const path = parts[2];
  if (!path) {
    tex.ui.notify("Usage: /plugin skill add <path-to-skill-directory> [module]", "warning");
    return;
  }

  const module = parts[3]; // optional
  const absolutePath = join(getPluginsDir(), path);
  const skillName = skillNameFromPath(path);

  const validationError = validateSkillTarget(absolutePath);
  if (validationError) {
    tex.ui.notify(validationError, "error");
    return;
  }

  const symlinkPath = path;
  try {
    createWrapper(tex.cwd, skillName, symlinkPath, module);
    tex.ui.notify(`Added skill "${skillName}" → ${path}`, "info");

    if (tex.reload) {
      tex.ui.notify("Reloading to activate new skill...", "info");
      await tex.reload();
    }
  } catch (err: unknown) {
    tex.ui.notify((err as Error).message, "error");
  }
}

export async function handleSkillRemove(parts: string[], tex: PluginExecutionContext): Promise<void> {
  const name = parts[2];
  if (!name) {
    tex.ui.notify("Usage: /plugin skill remove <skill-name>", "warning");
    return;
  }

  try {
    removeWrapper(tex.cwd, name);
    tex.ui.notify(`Removed skill "${name}"`, "info");

    if (tex.reload) {
      tex.ui.notify("Reloading to apply skill removal...", "info");
      await tex.reload();
    }
  } catch (err: unknown) {
    tex.ui.notify((err as Error).message, "error");
  }
}

export async function handleSkillTag(parts: string[], tex: PluginExecutionContext): Promise<void> {
  const skillName = parts[2];
  const module = parts[3];

  if (!skillName || !module) {
    tex.ui.notify("Usage: /plugin skill tag <skill-name> <module>", "warning");
    return;
  }

  const wrapperDir = join(tex.cwd, WRAPPER_SKILLS_DIR, skillName);
  const wrapperPath = join(wrapperDir, "WRAPPER.md");
  const trueSkillDir = join(tex.cwd, ".pi", "skills", skillName);
  const skillPath = join(trueSkillDir, "SKILL.md");

  let targetPath: string;
  if (existsSync(wrapperPath)) {
    targetPath = wrapperPath;
  } else if (existsSync(skillPath)) {
    targetPath = skillPath;
  } else {
    tex.ui.notify(`Skill "${skillName}" not found.`, "error");
    return;
  }

  const content = readFileSync(targetPath, "utf-8");
  const updated = setModuleInFrontmatter(content, module);
  writeFileSync(targetPath, updated);

  const fileName = targetPath.endsWith("WRAPPER.md") ? "WRAPPER.md" : "SKILL.md";
  tex.ui.notify(`Tagged "${skillName}" with module "${module}" in ${fileName}.`, "info");

  if (tex.reload) {
    tex.ui.notify("Reloading to apply skill tag changes...", "info");
    await tex.reload();
  }
}

/**
 * Extract the skill name (last path segment) from a relative path.
 */
function skillNameFromPath(path: string): string {
  const segments = path.replace(/\/+$/, "").split("/");
  return segments[segments.length - 1];
}

function parseFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: "", body: content };
  return { frontmatter: match[1], body: match[2] };
}

function setModuleInFrontmatter(content: string, module: string): string {
  const { frontmatter, body } = parseFrontmatter(content);

  let newFrontmatter: string;
  const hasModule = /^module:.*$/m.test(frontmatter);
  if (hasModule) {
    newFrontmatter = frontmatter.replace(/^module:.*$/m, `module: ${module}`);
  } else {
    newFrontmatter = frontmatter.trimEnd() + `\nmodule: ${module}`;
  }

  return `---\n${newFrontmatter}\n---\n${body}`;
}
