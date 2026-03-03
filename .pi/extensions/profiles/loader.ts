import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProfileFile } from "./types.js";

const PROFILE_FILE_EXTENSION_REGEX = /\.ya?ml$/;

export function getProfilesDir(cwd: string): string {
  return join(cwd, ".pi", "profiles");
}

export function listProfileFiles(cwd: string): ProfileFile[] {
  const directory = getProfilesDir(cwd);
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory)
    .filter((filename) => PROFILE_FILE_EXTENSION_REGEX.test(filename))
    .map((filename) => ({
      basename: filename.replace(PROFILE_FILE_EXTENSION_REGEX, ""),
      filename,
      path: join(directory, filename),
    }));
}

export function resolveProfileFile(cwd: string, inputName: string): ProfileFile {
  const allFiles = listProfileFiles(cwd);
  const normalizedInput = inputName.trim();

  const exactMatches = allFiles.filter((file) => file.basename === normalizedInput);
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  const partialMatches = allFiles.filter((file) => file.basename.startsWith(normalizedInput));
  const matches = exactMatches.length > 1 ? exactMatches : partialMatches;

  if (matches.length === 0) {
    throw new Error(`Profile not found: ${inputName}`);
  }

  if (matches.length > 1) {
    const options = matches.map((match) => match.filename).join(", ");
    throw new Error(`Ambiguous profile name \"${inputName}\". Matches: ${options}`);
  }

  return matches[0];
}

export function readProfileYaml(cwd: string, inputName: string): { file: ProfileFile; content: string } {
  const file = resolveProfileFile(cwd, inputName);
  const content = readFileSync(file.path, "utf-8");
  return { file, content };
}
