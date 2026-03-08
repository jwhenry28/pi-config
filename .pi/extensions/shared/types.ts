import type { Skill } from "@mariozechner/pi-coding-agent";
import { readFileSync } from "node:fs";

/**
 * A skill with parsed frontmatter attached.
 * All skills returned by loadAllSkills() are ResolvedSkills.
 */
export interface ResolvedSkill extends Skill {
  /** Merged frontmatter (wrapper frontmatter wins over SKILL.md frontmatter on conflicts) */
  frontmatter: Record<string, unknown>;
}

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns an empty object if no frontmatter block is found.
 *
 * Handles simple flat YAML (key: value pairs). For our use case
 * (skill frontmatter), this is sufficient — we don't need nested YAML.
 */
export function parseFrontmatter(filePath: string): Record<string, unknown> {
  try {
    const content = readFileSync(filePath, "utf-8");
    return parseFrontmatterFromString(content);
  } catch {
    return {};
  }
}

/**
 * Parse frontmatter from a string (exported for testing).
 */
export function parseFrontmatterFromString(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const result: Record<string, unknown> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    if (key === "") continue;

    let value: unknown = line.slice(colonIndex + 1).trim();

    // Strip surrounding quotes
    if (typeof value === "string" && value.length >= 2 &&
        ((value.startsWith("'") && value.endsWith("'")) ||
         (value.startsWith('"') && value.endsWith('"')))) {
      value = value.slice(1, -1);
    }

    // Coerce simple types
    if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) value = Number(value);

    result[key] = value;
  }
  return result;
}
