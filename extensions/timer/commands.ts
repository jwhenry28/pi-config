import { cancelTimer, listTimers } from "./state.js";
import { setTimerFromInput, type TimerUI, type TimerPi } from "./tools.js";

// ── Command handler ───────────────────────────────────────────────

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
