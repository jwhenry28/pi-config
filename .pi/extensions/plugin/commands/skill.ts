import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { handleSkillAdd, handleSkillRemove, handleSkillTag } from "../skill.js";
import { getSkillAddPathCompletions, getWrapperSkillCompletions } from "../completions.js";
import type { PluginExecutionContext } from "../constants.js";

export function getSkillCompletions(subcommand: string, prefix: string, cwd: string): AutocompleteItem[] | null {
  if (subcommand === "add") {
    return getSkillAddPathCompletions(prefix);
  }
  if (subcommand === "remove" || subcommand === "tag") {
    return getWrapperSkillCompletions(subcommand, prefix, cwd);
  }
  return null;
}

export async function dispatchSkillCommand(parts: string[], tex: PluginExecutionContext): Promise<void> {
  switch (parts[1]) {
    case "add":
      await handleSkillAdd(parts, tex);
      break;
    case "remove":
      await handleSkillRemove(parts, tex);
      break;
    case "tag":
      await handleSkillTag(parts, tex);
      break;
    default:
      tex.ui.notify("Usage: /plugin skill <add|remove|tag> [args...]", "warning");
  }
}
