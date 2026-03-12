import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { clearAll, listTimers } from "./state.js";
import { handleTimerCommand } from "./commands.js";
import { executeSetTimer, executeListTimers, executeCancelTimer } from "./tools.js";

// Re-export for tests
export { handleTimerCommand, parseSetArgs, type ParsedSetArgs } from "./commands.js";
export { executeSetTimer, executeListTimers, executeCancelTimer } from "./tools.js";

// ── Extension registration ────────────────────────────────────────

export default function timerExtension(pi: ExtensionAPI) {
  pi.on("session_start", async () => {
    clearAll();
  });

  pi.registerCommand("timer", {
    description: "Manage timers: set, list, cancel",
    getArgumentCompletions: (prefix: string) => getTimerCompletions(prefix),
    handler: async (args, ctx) => {
      handleTimerCommand(args, ctx.ui, pi);
    },
  });

  pi.registerTool({
    name: "set_timer",
    label: "Set Timer",
    description:
      "Set a timer that sends a prompt to the agent after a specified delay. " +
      "Duration format: e.g. 5m, 60m, 2h. " +
      "If recurring is true, the prompt is sent repeatedly at the given interval.",
    parameters: Type.Object({
      duration: Type.String({ description: 'Timer duration, e.g. "5m", "60m", "2h"' }),
      prompt: Type.String({ description: "Message to send when the timer fires" }),
      recurring: Type.Optional(Type.Boolean({ description: "If true, fire repeatedly (default: false)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executeSetTimer(params as { duration: string; prompt: string; recurring?: boolean }, ctx.ui, pi);
    },
  });

  pi.registerTool({
    name: "list_timers",
    label: "List Timers",
    description: "List all active timers with their IDs, durations, types, and prompts.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      return executeListTimers();
    },
  });

  pi.registerTool({
    name: "cancel_timer",
    label: "Cancel Timer",
    description: "Cancel an active timer by its ID.",
    parameters: Type.Object({
      id: Type.String({ description: "Timer ID to cancel (from set_timer or list_timers)" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return executeCancelTimer((params as { id: string }).id, ctx.ui);
    },
  });
}

// ── Autocompletion ────────────────────────────────────────────────

const SUBCOMMANDS: AutocompleteItem[] = [
  { value: "set", label: "set — Create a timer" },
  { value: "list", label: "list — Show active timers" },
  { value: "cancel", label: "cancel — Cancel a timer" },
  { value: "help", label: "help — Show help" },
];

export function getTimerCompletions(prefix: string): AutocompleteItem[] | null {
  const trimmed = prefix.trimStart();

  // After a subcommand has been typed (contains a space)
  if (trimmed.includes(" ")) {
    const spaceIdx = trimmed.indexOf(" ");
    const sub = trimmed.slice(0, spaceIdx);
    const rest = trimmed.slice(spaceIdx + 1).trimStart();

    // Only provide completions for "cancel <id>"
    if (sub !== "cancel" || rest.includes(" ")) return null;

    const entries = listTimers();
    if (entries.length === 0) return null;

    const filtered = entries.filter((e) => e.id.startsWith(rest));
    return filtered.length > 0
      ? filtered.map((e) => {
          const typeLabel = e.recurring ? "recurring" : "one-shot";
          const truncated = e.prompt.length > 40 ? e.prompt.slice(0, 37) + "..." : e.prompt;
          return {
            value: `cancel ${e.id}`,
            label: e.id,
            description: `${typeLabel} ${e.durationStr} — ${truncated}`,
          };
        })
      : null;
  }

  const filtered = SUBCOMMANDS.filter((item) => item.value.startsWith(trimmed));
  return filtered.length > 0 ? filtered : null;
}
