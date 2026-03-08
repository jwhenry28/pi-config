import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { handleWorkflowAdd, handleWorkflowRemove } from "../workflow.js";
import { getWorkflowAddCompletions, getLocalWorkflowCompletions } from "../completions.js";
import type { PluginExecutionContext } from "../constants.js";

export function getWorkflowCompletions(subcommand: string, prefix: string, cwd: string): AutocompleteItem[] | null {
  if (subcommand === "add") {
    return getWorkflowAddCompletions(prefix);
  }
  if (subcommand === "remove") {
    return getLocalWorkflowCompletions(prefix, cwd);
  }
  return null;
}

export async function dispatchWorkflowCommand(parts: string[], tex: PluginExecutionContext): Promise<void> {
  switch (parts[1]) {
    case "add":
      await handleWorkflowAdd(parts, tex);
      break;
    case "remove":
      await handleWorkflowRemove(parts, tex);
      break;
    default:
      tex.ui.notify("Usage: /plugin workflow <add|remove> [args...]", "warning");
  }
}
