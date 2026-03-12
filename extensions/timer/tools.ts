import { parseDuration } from "./parse.js";
import { createTimer, cancelTimer, listTimers } from "./state.js";

// ── Interfaces ────────────────────────────────────────────────────

export interface TimerUI {
  notify: (msg: string, level: string) => void;
}

export interface TimerPi {
  sendUserMessage: (content: string, options?: { deliverAs?: "steer" | "followUp" }) => void;
}

export type ToolResult = { content: Array<{ type: "text"; text: string }> };

// ── Tool execute functions ────────────────────────────────────────

interface SetTimerParams {
  duration: string;
  prompt: string;
  recurring?: boolean;
}

export function executeSetTimer(params: SetTimerParams, ui: TimerUI, pi: TimerPi): ToolResult {
  const result = setTimerFromInput(params.duration, params.recurring ?? false, params.prompt, ui, pi);
  if (!result.ok) {
    return { content: [{ type: "text" as const, text: result.error }] };
  }
  return {
    content: [{ type: "text" as const, text: `Timer set (${result.typeLabel}, ${result.display}): ${params.prompt}\nID: ${result.id}` }],
  };
}

export function executeListTimers(): ToolResult {
  const entries = listTimers();
  if (entries.length === 0) {
    return { content: [{ type: "text" as const, text: "No active timers." }] };
  }

  const lines = entries.map((e) => {
    const typeLabel = e.recurring ? "recurring" : "one-shot";
    return `${e.id}  ${e.durationStr.padEnd(5)} ${typeLabel.padEnd(10)} ${e.prompt}`;
  });
  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}

export function executeCancelTimer(id: string, ui: TimerUI): ToolResult {
  if (cancelTimer(id)) {
    ui.notify(`Cancelled timer ${id}`, "info");
    return { content: [{ type: "text" as const, text: `Cancelled timer ${id}.` }] };
  }
  return { content: [{ type: "text" as const, text: `Timer "${id}" not found.` }] };
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

export function setTimerFromInput(
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
      const time = new Date().toLocaleTimeString("en-US", { hour12: false });
      ui.notify(`⏱ Timer ${id} fired (${time})`, "info");
      pi.sendUserMessage(prompt, { deliverAs: "followUp" });
    },
  });

  const typeLabel = recurring ? "recurring" : "one-shot";
  return { ok: true, id: entry.id, typeLabel, display: duration.display };
}
