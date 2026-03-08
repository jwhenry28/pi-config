import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { stringify } from "yaml";
import { WRAPPER_SKILLS_DIR, WORKFLOWS_DIR, CONFIGS_DIR } from "../shared/paths.js";
import { getPluginsDir } from "../shared/home.js";

/** Write .pi/skills/<name>/SKILL.md (native skills, not wrappers) */
export function writeSkill(cwd: string, name: string, content: string): void {
  const dir = join(cwd, ".pi", "skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), content, "utf-8");
}

/** Write .pi-config/skills/<name>/WRAPPER.md */
export function writeWrapper(cwd: string, name: string, symlink: string, module?: string): void {
  const dir = join(cwd, WRAPPER_SKILLS_DIR, name);
  mkdirSync(dir, { recursive: true });
  let yaml = `---\nsymlink: '${symlink}'`;
  if (module) yaml += `\nmodule: ${module}`;
  yaml += "\n---\n";
  writeFileSync(join(dir, "WRAPPER.md"), yaml, "utf-8");
}

/** Write .pi-config/workflows/<name>.yml */
export function writeWorkflow(cwd: string, name: string, config: object): void {
  const dir = join(cwd, WORKFLOWS_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.yml`), stringify(config), "utf-8");
}

/** Write .pi-config/configs/<filename> */
export function writeConfigFile(cwd: string, filename: string, content: string): void {
  const dir = join(cwd, CONFIGS_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content, "utf-8");
}

/** Write ~/.pi/plugins/<name>/ with optional files (uses getPluginsDir from home override) */
export function writeGlobalPluginDir(name: string, files?: { path: string; content: string }[]): void {
  const dir = join(getPluginsDir(), name);
  mkdirSync(dir, { recursive: true });
  if (files) {
    for (const f of files) {
      const fullPath = join(dir, f.path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, f.content, "utf-8");
    }
  }
}

/** Write a todo markdown file with checkbox items */
export function writeTodo(
  cwd: string,
  filepath: string,
  items: Array<{ text: string; checked: boolean }>
): void {
  const fullPath = join(cwd, filepath);
  mkdirSync(dirname(fullPath), { recursive: true });
  const lines = items.map((item) => `- [${item.checked ? "x" : " "}] ${item.text}`);
  writeFileSync(fullPath, lines.join("\n") + "\n", "utf-8");
}

/** Write a file at an arbitrary relative path (for prompt files, etc.) */
export function writeFile(cwd: string, relativePath: string, content: string): void {
  const fullPath = join(cwd, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}
