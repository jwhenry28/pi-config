import { existsSync, mkdirSync, writeFileSync, unlinkSync, readdirSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { WRAPPER_SKILLS_DIR } from "../shared/paths.js";

/**
 * Generate WRAPPER.md content.
 */
export function generateWrapperContent(symlinkPath: string, module?: string): string {
  let content = `---\nsymlink: '${symlinkPath}'\n`;
  if (module) content += `module: ${module}\n`;
  content += "---\n";
  return content;
}

/**
 * Validate that a skill target path exists and contains SKILL.md.
 * Returns error string or null if valid.
 */
export function validateSkillTarget(absolutePath: string): string | null {
  if (!existsSync(absolutePath)) {
    return `Target path does not exist: ${absolutePath}`;
  }
  if (!existsSync(join(absolutePath, "SKILL.md"))) {
    return `Target path has no SKILL.md: ${absolutePath}`;
  }
  return null;
}

/**
 * Create a WRAPPER.md in .pi-config/skills/<skillName>/.
 * Throws if WRAPPER.md or SKILL.md already exists there.
 */
export function createWrapper(cwd: string, skillName: string, symlinkPath: string, module?: string): void {
  const skillDir = join(cwd, WRAPPER_SKILLS_DIR, skillName);
  const wrapperPath = join(skillDir, "WRAPPER.md");

  if (existsSync(wrapperPath)) {
    throw new Error(`WRAPPER.md already exists for skill "${skillName}"`);
  }

  mkdirSync(skillDir, { recursive: true });
  writeFileSync(wrapperPath, generateWrapperContent(symlinkPath, module));
}

/**
 * Remove a WRAPPER.md from .pi-config/skills/<skillName>/.
 * Removes directory if empty. Throws if no WRAPPER.md.
 */
export function removeWrapper(cwd: string, skillName: string): void {
  const skillDir = join(cwd, WRAPPER_SKILLS_DIR, skillName);
  const wrapperPath = join(skillDir, "WRAPPER.md");

  if (!existsSync(wrapperPath)) {
    throw new Error(`No WRAPPER.md found for skill "${skillName}"`);
  }

  unlinkSync(wrapperPath);

  // Remove directory if empty
  try {
    const remaining = readdirSync(skillDir);
    if (remaining.length === 0) rmdirSync(skillDir);
  } catch {
    // Directory may already be gone
  }
}
