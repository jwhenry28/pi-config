import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { stringify } from "yaml";
import { WORKFLOWS_DIR, CONFIGS_DIR } from "../shared/paths.js";
import { getPluginsDir } from "../shared/home.js";

/** Write .pi/skills/<name>/SKILL.md */
export function writeSkill(cwd: string, name: string, content: string): void {
  const dir = join(cwd, ".pi", "skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), content, "utf-8");
}

/** Write .pi/workflows/<name>.yml */
export function writeWorkflow(cwd: string, name: string, config: object): void {
  const dir = join(cwd, WORKFLOWS_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.yml`), stringify(config), "utf-8");
}

/** Write .pi/configs/<filename> */
export function writeConfigFile(cwd: string, filename: string, content: string): void {
  const dir = join(cwd, CONFIGS_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content, "utf-8");
}

/** Write ~/.pi/plugins/<name>/ with structured content (uses getPluginsDir from home override) */
export function writeGlobalPluginDir(
  name: string,
  options?: {
    skills?: { name: string; content: string }[];
    prompts?: { name: string; content: string }[];
    workflows?: { name: string; config: object }[];
    files?: { path: string; content: string }[];
  }
): void {
  const dir = join(getPluginsDir(), name);
  mkdirSync(dir, { recursive: true });
  if (options?.skills) {
    for (const s of options.skills) {
      const skillDir = join(dir, "skills", s.name);
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), s.content, "utf-8");
    }
  }
  if (options?.prompts) {
    for (const p of options.prompts) {
      const filename = p.name.endsWith(".md") ? p.name : `${p.name}.md`;
      const fullPath = join(dir, "prompts", filename);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, p.content, "utf-8");
    }
  }
  if (options?.workflows) {
    for (const w of options.workflows) {
      const wfDir = join(dir, "workflows");
      mkdirSync(wfDir, { recursive: true });
      writeFileSync(join(wfDir, `${w.name}.yml`), stringify(w.config), "utf-8");
    }
  }
  if (options?.files) {
    for (const f of options.files) {
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

/** Write .pi/prompts/<name>.md (name can be nested, e.g. "pack/task") */
export function writePrompt(cwd: string, name: string, content: string): void {
  const filename = name.endsWith(".md") ? name : `${name}.md`;
  const fullPath = join(cwd, ".pi", "prompts", filename);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

/** Write a file at an arbitrary relative path (for prompt files, etc.) */
export function writeFile(cwd: string, relativePath: string, content: string): void {
  const fullPath = join(cwd, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}
