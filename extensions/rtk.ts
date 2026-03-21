/**
 * RTK (Rust Token Killer) integration extension.
 *
 * Rewrites bash tool calls through `rtk rewrite` so command output
 * is token-optimised (60-90 % savings) before it enters the LLM context.
 *
 * Requires the `rtk` binary (>= 0.23.0) on PATH.
 *   cargo install rtk          # or build from source
 *   rtk --version              # verify
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const LOG_DIR = join(process.env.HOME ?? "/tmp", ".pi", "logs");
const LOG_FILE = join(LOG_DIR, "rtk.log");

let debugEnabled = false;

function log(msg: string): void {
  if (!debugEnabled) return;
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    const ts = new Date().toISOString();
    appendFileSync(LOG_FILE, `[${ts}] ${msg}\n`);
  } catch {
    // best-effort logging — never break the extension
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the absolute path to `rtk` once, at load time. */
function findRtk(): string | null {
  try {
    return execFileSync("which", ["rtk"], { encoding: "utf-8" }).trim() || null;
  } catch {
    return null;
  }
}

/** Minimum version that supports `rtk rewrite`. */
function meetsMinVersion(rtkPath: string): boolean {
  try {
    const raw = execFileSync(rtkPath, ["--version"], { encoding: "utf-8" });
    const match = raw.match(/(\d+)\.(\d+)\.(\d+)/);
    if (!match) return false;
    const [, major, minor] = match.map(Number);
    return major > 0 || minor >= 23;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function rtkExtension(pi: ExtensionAPI) {
  const rtkPath = findRtk();
  const available = rtkPath !== null && meetsMinVersion(rtkPath);

  log(`extension loaded — rtk path: ${rtkPath ?? "NOT FOUND"}, available: ${available}`);

  // -- Session start: warn once if rtk is missing or too old ----------------

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    if (!rtkPath) {
      ctx.ui.notify("[rtk] binary not found — token savings disabled. Install with: cargo install rtk", "warning");
      return;
    }
    if (!available) {
      ctx.ui.notify("[rtk] version too old (need >= 0.23.0). Upgrade with: cargo install rtk", "warning");
    }
  });

  if (!available) return; // nothing else to register

  // -- Rewrite bash commands via `rtk rewrite` -----------------------------

  pi.on("tool_call", async (event) => {
    if (!isToolCallEventType("bash", event)) return;

    const cmd = event.input.command;
    if (!cmd) return;

    log(`tool_call intercepted — original: ${cmd}`);

    try {
      const rewritten = execFileSync(rtkPath!, ["rewrite", cmd], {
        encoding: "utf-8",
        timeout: 1000,
      }).trim();

      if (rewritten && rewritten !== cmd) {
        log(`rewritten: "${cmd}" → "${rewritten}"`);
        event.input.command = rewritten;
      } else {
        log(`no rewrite needed (pass-through): ${cmd}`);
      }
    } catch {
      // rtk rewrite exits 1 when there is no applicable rewrite — pass through silently.
      log(`no rtk filter for: ${cmd}`);
    }
  });

  // -- Inject awareness note into system prompt ----------------------------

  pi.on("before_agent_start", async (event) => {
    return {
      systemPrompt:
        event.systemPrompt +
        "\n\n" +
        "<rtk>\n" +
        "Bash command outputs are automatically token-optimised by RTK.\n" +
        "Filtered output is intentionally concise — do NOT re-run commands assuming truncation.\n" +
        "Use `rtk gain` to see cumulative token savings.\n" +
        "Use `rtk proxy <cmd>` if you need full unfiltered output.\n" +
        "</rtk>",
    };
  });

  // -- `/rtk` command for quick access to stats ----------------------------

  pi.registerCommand("rtk", {
    description: "RTK token savings — stats, debug logging",
    getArgumentCompletions: (prefix) => {
      const options = [
        { value: "gain", label: "gain — Overall savings summary" },
        { value: "gain --history", label: "gain --history — Recent command history" },
        { value: "gain --graph", label: "gain --graph — 30-day savings graph" },
        { value: "gain --daily", label: "gain --daily — Day-by-day breakdown" },
        { value: "discover", label: "discover — Find missed optimisation opportunities" },
        { value: "enable-debug", label: "enable-debug — Turn on debug logging" },
        { value: "disable-debug", label: "disable-debug — Turn off debug logging" },
      ];
      const trimmed = prefix.trim();
      const filtered = options.filter((o) => o.value.startsWith(trimmed));
      return filtered.length > 0 ? filtered : null;
    },
    handler: async (args, ctx) => {
      const subcommand = args.trim() || "gain";

      if (subcommand === "enable-debug") {
        debugEnabled = true;
        log("debug logging enabled");
        ctx.ui.notify(`[rtk] Debug logging enabled → ${LOG_FILE}`, "info");
        return;
      }

      if (subcommand === "disable-debug") {
        log("debug logging disabled");
        debugEnabled = false;
        ctx.ui.notify("[rtk] Debug logging disabled", "info");
        return;
      }

      try {
        const output = execFileSync(rtkPath!, subcommand.split(/\s+/), {
          encoding: "utf-8",
          timeout: 5000,
        });
        ctx.ui.notify(output, "info");
      } catch (err: any) {
        ctx.ui.notify(`rtk ${subcommand} failed: ${err.message ?? err}`, "error");
      }
    },
  });
}
