import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { parseDuration } from "./parse.js";
import { createTimer, cancelTimer, listTimers, clearAll } from "./state.js";

// ── Interfaces ────────────────────────────────────────────────────

interface TimerUI {
  notify: (msg: string, level: string) => void;
}

interface TimerPi {
  sendUserMessage: (content: string, options?: { deliverAs?: "steer" | "followUp" }) => void;
}

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
      return executeSetTimer(params as SetTimerParams, ctx.ui, pi);
    },
  });
}

// ── Command handler (exported for unit tests) ─────────────────────

export function handleTimerCommand(args: string, ui: TimerUI, pi: TimerPi): void {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  const subcommand = parts[0] ?? "";

  if (!subcommand || subcommand === "help") {
    showHelp(ui);
    return;
  }

  switch (subcommand) {
    case "set":
      handleSet(parts, ui, pi);
      break;
    case "list":
      handleList(ui);
      break;
    case "cancel":
      handleCancel(parts, ui);
      break;
    default:
      ui.notify(`Unknown subcommand: ${subcommand}. Use set, list, cancel, or help.`, "warning");
  }
}

// ── Tool execute function (exported for tests) ───────────────────

interface SetTimerParams {
  duration: string;
  prompt: string;
  recurring?: boolean;
}

export function executeSetTimer(
  params: SetTimerParams,
  ui: TimerUI,
  pi: TimerPi,
): { content: Array<{ type: "text"; text: string }> } {
  const result = setTimerFromInput(params.duration, params.recurring ?? false, params.prompt, ui, pi);
  if (!result.ok) {
    return { content: [{ type: "text" as const, text: result.error }] };
  }
  return {
    content: [{ type: "text" as const, text: `Timer ${result.id} set (${result.typeLabel}, ${result.display}): ${params.prompt}` }],
  };
}

// ── Shared timer creation ─────────────────────────────────────────

interface SetTimerSuccess {
  ok: true;
  id: string;
  typeLabel: string;
  display: string;
}

interface SetTimerFailure {
  ok: false;
  error: string;
}

function setTimerFromInput(
  durationStr: string,
  recurring: boolean,
  prompt: string,
  ui: TimerUI,
  pi: TimerPi,
): SetTimerSuccess | SetTimerFailure {
  const duration = parseDuration(durationStr);
  if (!duration) {
    return { ok: false, error: `Invalid duration: "${durationStr}". Use e.g. 5m, 60m, 2h.` };
  }

  const entry = createTimer({
    prompt,
    intervalMs: duration.ms,
    durationStr: duration.display,
    recurring,
    onFire: (id) => {
      ui.notify(`⏱ Timer ${id} fired`, "info");
      pi.sendUserMessage(prompt, { deliverAs: "followUp" });
    },
  });

  const typeLabel = recurring ? "recurring" : "one-shot";
  return { ok: true, id: entry.id, typeLabel, display: duration.display };
}

// ── Subcommand handlers ───────────────────────────────────────────

function handleSet(parts: string[], ui: TimerUI, pi: TimerPi): void {
  const parsed = parseSetArgs(parts);
  if (!parsed) {
    ui.notify("Usage: /timer set <duration> [--recurring] <prompt>", "error");
    return;
  }

  const result = setTimerFromInput(parsed.durationStr, parsed.recurring, parsed.prompt, ui, pi);
  if (!result.ok) {
    ui.notify(result.error, "error");
    return;
  }

  ui.notify(`Timer ${result.id} set (${result.typeLabel}, ${result.display}): ${parsed.prompt}`, "info");
}

function handleList(ui: TimerUI): void {
  const entries = listTimers();
  if (entries.length === 0) {
    ui.notify("No active timers.", "info");
    return;
  }

  const lines = ["Active timers:"];
  for (const e of entries) {
    const typeLabel = e.recurring ? "recurring" : "one-shot";
    const truncated = e.prompt.length > 50 ? e.prompt.slice(0, 47) + "..." : e.prompt;
    lines.push(`  ${e.id}  ${e.durationStr.padEnd(5)} ${typeLabel.padEnd(10)} ${truncated}`);
  }
  ui.notify(lines.join("\n"), "info");
}

function handleCancel(parts: string[], ui: TimerUI): void {
  const id = parts[1];
  if (!id) {
    ui.notify("Usage: /timer cancel <id>", "error");
    return;
  }

  if (cancelTimer(id)) {
    ui.notify(`Cancelled timer ${id}`, "info");
  } else {
    ui.notify(`Timer "${id}" not found.`, "error");
  }
}

function showHelp(ui: TimerUI): void {
  ui.notify(
    [
      "Usage: /timer <subcommand> [args...]",
      "",
      "  set <duration> [--recurring] <prompt>   Create a timer",
      "  list                                    Show active timers",
      "  cancel <id>                             Cancel a timer by ID",
      "  help                                    Show this message",
      "",
      "Duration: e.g. 5m, 60m, 2h",
    ].join("\n"),
    "info",
  );
}

// ── Argument parsing ──────────────────────────────────────────────

export interface ParsedSetArgs {
  durationStr: string;
  recurring: boolean;
  prompt: string;
}

export function parseSetArgs(parts: string[]): ParsedSetArgs | null {
  const durationStr = parts[1];
  if (!durationStr) return null;

  const rest = parts.slice(2);
  const recurring = rest.includes("--recurring");
  const promptParts = rest.filter((p) => p !== "--recurring");
  const prompt = promptParts.join(" ").trim();

  if (!prompt) return null;

  return { durationStr, recurring, prompt };
}

// ── Autocompletion ────────────────────────────────────────────────

const SUBCOMMANDS: AutocompleteItem[] = [
  { value: "set", label: "set — Create a timer" },
  { value: "list", label: "list — Show active timers" },
  { value: "cancel", label: "cancel — Cancel a timer" },
  { value: "help", label: "help — Show help" },
];

function getTimerCompletions(prefix: string): AutocompleteItem[] | null {
  const trimmed = prefix.trimStart();
  if (trimmed.includes(" ")) return null;
  const filtered = SUBCOMMANDS.filter((item) => item.value.startsWith(trimmed));
  return filtered.length > 0 ? filtered : null;
}
