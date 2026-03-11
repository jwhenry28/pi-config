import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { getHomeDir, getPluginsDir } from "../shared/home.js";

/**
 * Resolve a prompt reference (after stripping @ prefix) to an absolute path.
 *
 * Resolution order:
 * 1) local prompt file: <cwd>/.pi/prompts/<head>.md (only for single-segment refs)
 * 2) local prompt directory file: <cwd>/.pi/prompts/<head>/<tail>.md
 * 3) home prompt directory file: <home>/.pi/prompts/<head>/<tail>.md
 * 4) known-plugin-head file: ~/.pi/plugins/<ref>.md (if <head> repo directory exists)
 * 5) plugin fallback file: ~/.pi/plugins/<ref>.md
 */
export function resolvePromptRef(ref: string, cwd: string): string {
  const { head, tail } = parseRef(ref);
  const localPromptsDir = join(cwd, ".pi", "prompts");
  const homePromptsDir = join(getHomeDir(), ".pi", "prompts");

  throwIfBareDirectoryReference(ref, head, tail, localPromptsDir, homePromptsDir);

  const candidates = buildCandidates(ref, head, tail, localPromptsDir, homePromptsDir);
  const existingFiles = candidates.filter((candidate) => isFile(candidate));

  if (existingFiles.length === 1) {
    return existingFiles[0];
  }

  if (existingFiles.length > 1) {
    const matches = existingFiles.join(", ");
    const attempted = candidates.join(", ");
    throw new Error(`Ambiguous prompt reference "${ref}". Matches: ${matches}. Attempted: ${attempted}`);
  }

  const attempted = candidates.join(", ");
  throw new Error(`Prompt reference not found: "${ref}". Attempted: ${attempted}`);
}

function parseRef(ref: string): { head: string; tail: string } {
  const parts = ref.split("/").filter(Boolean);
  const head = parts[0] ?? "";
  const tail = parts.slice(1).join("/");

  if (head.length > 0) {
    return { head, tail };
  }

  throw new Error(`Invalid prompt reference: "${ref}"`);
}

function buildCandidates(ref: string, head: string, tail: string, localPromptsDir: string, homePromptsDir: string): string[] {
  const candidates: string[] = [];

  const isSingleSegmentRef = tail.length === 0;
  if (isSingleSegmentRef) {
    candidates.push(join(localPromptsDir, withMd(head)));
  }

  const isNestedRef = tail.length > 0;
  if (isNestedRef) {
    candidates.push(join(localPromptsDir, head, withMd(tail)));
    candidates.push(join(homePromptsDir, head, withMd(tail)));
  }

  const pluginCandidate = join(getPluginsDir(), withMd(ref));
  const knownPluginHeadDir = join(getPluginsDir(), head);
  const knownPluginHeadExists = isDirectory(knownPluginHeadDir);
  if (knownPluginHeadExists) {
    candidates.push(pluginCandidate);
  }

  const alreadyIncludesPluginCandidate = candidates.includes(pluginCandidate);
  if (!alreadyIncludesPluginCandidate) {
    candidates.push(pluginCandidate);
  }

  return candidates;
}

function throwIfBareDirectoryReference(ref: string, head: string, tail: string, localPromptsDir: string, homePromptsDir: string): void {
  const isSingleSegmentRef = tail.length === 0;
  if (!isSingleSegmentRef) {
    return;
  }

  const localDirectory = join(localPromptsDir, head);
  const homeDirectory = join(homePromptsDir, head);
  const pointsToDirectory = isDirectory(localDirectory) || isDirectory(homeDirectory);

  if (!pointsToDirectory) {
    return;
  }

  throw new Error(`Prompt reference "${ref}" points to a directory. Use @${head}/<file>.md`);
}

function withMd(pathLike: string): string {
  if (pathLike.endsWith(".md")) {
    return pathLike;
  }

  return `${pathLike}.md`;
}

function isFile(path: string): boolean {
  if (!existsSync(path)) {
    return false;
  }

  return statSync(path).isFile();
}

function isDirectory(path: string): boolean {
  if (!existsSync(path)) {
    return false;
  }

  return statSync(path).isDirectory();
}
