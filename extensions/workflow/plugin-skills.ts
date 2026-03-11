import { join } from "node:path";
import { getPluginsDir } from "../shared/home.js";

/**
 * A skill ref containing `/` is a plugin path reference.
 * Otherwise it's a by-name reference (existing behavior).
 */
export function isPluginSkillRef(ref: string): boolean {
	return ref.includes("/");
}

/**
 * Resolve a plugin skill ref to an absolute path to SKILL.md.
 * First segment is the repo name, rest is the path within the repo.
 * E.g. "my-repo/skills/some-skill" → ~/.pi/plugins/my-repo/skills/some-skill/SKILL.md
 */
export function resolvePluginSkillPath(ref: string): string {
	const segments = ref.split("/");
	return join(getPluginsDir(), ...segments, "SKILL.md");
}

/**
 * Extract the `name` field from YAML frontmatter in a SKILL.md file.
 * Returns null if no frontmatter or no name field.
 */
export function parseSkillName(content: string): string | null {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return null;
	const nameMatch = match[1].match(/^name:\s*(.+)$/m);
	return nameMatch ? nameMatch[1].trim() : null;
}
