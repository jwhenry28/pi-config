import { existsSync, readdirSync } from "node:fs";
import type { AutocompleteItem } from "@mariozechner/pi-tui";

const YAML_FILE_REGEX = /\.ya?ml$/;

export function listYamlBasenames(directory: string): string[] {
  const directoryExists = existsSync(directory);
  if (!directoryExists) {
    return [];
  }

  return readdirSync(directory)
    .filter((filename) => YAML_FILE_REGEX.test(filename))
    .map((filename) => filename.replace(YAML_FILE_REGEX, ""));
}

export function completeNames(prefix: string, names: string[]): AutocompleteItem[] | null {
  const trimmedPrefix = prefix.trim();
  const matches = names
    .filter((name) => name.startsWith(trimmedPrefix))
    .map((name) => ({ value: name, label: name }));

  const hasMatches = matches.length > 0;
  if (!hasMatches) {
    return null;
  }

  return matches;
}
