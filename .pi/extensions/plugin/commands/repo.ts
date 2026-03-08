import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { handleRepoDownload, handleRepoUpdate, handleRepoRemove } from "../repo.js";
import { getRepoNameCompletions } from "../completions.js";
import type { PluginExecutionContext } from "../constants.js";

export function getRepoCompletions(subcommand: string, prefix: string): AutocompleteItem[] | null {
  if (subcommand === "remove" || subcommand === "update") {
    return getRepoNameCompletions(subcommand, prefix);
  }
  return null;
}

export async function dispatchRepoCommand(parts: string[], tex: PluginExecutionContext): Promise<void> {
  switch (parts[1]) {
    case "download":
      await handleRepoDownload(parts, tex);
      break;
    case "update":
      await handleRepoUpdate(parts, tex);
      break;
    case "remove":
      await handleRepoRemove(parts, tex);
      break;
    default:
      tex.ui.notify("Usage: /plugin repo <download|update|remove> [args...]", "warning");
  }
}
