---
name: writing-pi-extensions
description: Use when creating, modifying, or debugging pi extensions - covers tools, events, commands, UI, state management, and custom rendering
---

# Writing Pi Extensions

Extensions are TypeScript modules that extend pi. They export a default function receiving `ExtensionAPI`.

## Quick Start

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Loaded!", "info");
  });
}
```

## Extension Locations

| Location | Scope |
| --- | --- |
| `~/.pi/agent/extensions/*.ts` | Global |
| `~/.pi/agent/extensions/*/index.ts` | Global (directory) |
| `.pi/extensions/*.ts` | Project-local |
| `.pi/extensions/*/index.ts` | Project-local (directory) |

Test with `pi -e ./my-extension.ts`. Use auto-discovered locations for `/reload` support.

## Available Imports

| Package | Purpose |
| --- | --- |
| `@mariozechner/pi-coding-agent` | Extension types, events, tool helpers |
| `@sinclair/typebox` | Schema definitions (`Type.Object`, etc.) |
| `@mariozechner/pi-ai` | `StringEnum` (required for Google-compatible enums) |
| `@mariozechner/pi-tui` | TUI components (`Text`, `Component`, `matchesKey`) |

npm deps work — add `package.json` next to extension, run `npm install`.

## Core Capabilities

### Registering Tools

```typescript
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does",
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),
    text: Type.Optional(Type.String()),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    onUpdate?.({ content: [{ type: "text", text: "Working..." }] });
    return {
      content: [{ type: "text", text: "Done" }],
      details: { result: "..." },
    };
  },
});
```

**Important:** Use `StringEnum` from `@mariozechner/pi-ai` for string enums — `Type.Union`/`Type.Literal` doesn't work with Google's API.

### Registering Commands

```typescript
pi.registerCommand("stats", {
  description: "Show session statistics",
  handler: async (args, ctx) => {
    const count = ctx.sessionManager.getEntries().length;
    ctx.ui.notify(`${count} entries`, "info");
  },
});
```

Commands receive `ExtensionCommandContext` which adds `waitForIdle()`, `newSession()`, `fork()`, `navigateTree()`, and `reload()`.

#### Command Autocompletion

Add `getArgumentCompletions` to provide tab-completion for command arguments. It receives the text after the command name and returns `AutocompleteItem[]` or `null`:

```typescript
import type { AutocompleteItem } from "@mariozechner/pi-tui";

pi.registerCommand("commands", {
  description: "List available slash commands",
  getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
    const options = ["extension", "prompt", "skill"];
    const filtered = options.filter((s) => s.startsWith(prefix));
    return filtered.length > 0
      ? filtered.map((s) => ({ value: s, label: s, description: `Filter by ${s}` }))
      : null;
  },
  handler: async (args, ctx) => { /* ... */ },
});
```

`AutocompleteItem` has: `value` (inserted text), `label` (display text), and optional `description`.

### Subscribing to Events

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
    return { block: true, reason: "Dangerous command" };
  }
});
```

### Sending Messages

```typescript
// Custom message (for context injection)
pi.sendMessage({ customType: "my-ext", content: "Info", display: true }, { deliverAs: "steer" });

// User message (triggers a turn)
pi.sendUserMessage("Do something");
```

Delivery modes: `"steer"` (interrupts), `"followUp"` (after current turn), `"nextTurn"` (queued).

## Event Lifecycle

```
session_start → input → before_agent_start → agent_start
  → turn_start → context → [tool_call → tool_result]* → turn_end
  → agent_end → session_shutdown
```

For the full event list and typed signatures, see [references/events.md](references/events.md).

## ExtensionContext (`ctx`)

Every handler receives `ctx` with:

- `ctx.ui` — Dialogs (`select`, `confirm`, `input`, `editor`), notifications, widgets, status
- `ctx.hasUI` — `false` in print/JSON mode
- `ctx.cwd` — Working directory
- `ctx.sessionManager` — Read-only session state (`getEntries()`, `getBranch()`, `getLeafId()`)
- `ctx.modelRegistry` / `ctx.model` — Model access
- `ctx.isIdle()` / `ctx.abort()` — Control flow
- `ctx.shutdown()` — Graceful shutdown (deferred until idle)
- `ctx.getContextUsage()` — Token usage
- `ctx.compact()` — Trigger compaction
- `ctx.getSystemPrompt()` — Current system prompt

## State Management

Store state in tool result `details` for proper branching support. Reconstruct from session on `session_start`:

```typescript
let items: string[] = [];

pi.on("session_start", async (_event, ctx) => {
  items = [];
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.role === "toolResult" && entry.message.toolName === "my_tool") {
      items = entry.message.details?.items ?? [];
    }
  }
});
```

Use `pi.appendEntry("my-state", data)` for non-LLM-context persistence.

## UI Methods

```typescript
// Dialogs
const choice = await ctx.ui.select("Pick:", ["A", "B", "C"]);
const ok = await ctx.ui.confirm("Sure?", "Details");
const name = await ctx.ui.input("Name:");

// Persistent UI
ctx.ui.setStatus("my-ext", "Processing...");
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"]);
ctx.ui.setWidget("my-widget", lines, { placement: "belowEditor" });
ctx.ui.notify("Done!", "info");

// Complex custom UI
const result = await ctx.ui.custom<boolean>((tui, theme, keybindings, done) => {
  const text = new Text("Press Enter or Escape", 1, 1);
  text.onKey = (key) => {
    if (key === "return") done(true);
    if (key === "escape") done(false);
    return true;
  };
  return text;
});
```

Dialogs support `timeout` option for auto-dismiss with countdown.

## Output Truncation

Tools **must** truncate output. Use built-in utilities:

```typescript
import { truncateHead, truncateTail, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES } from "@mariozechner/pi-coding-agent";

const truncation = truncateHead(output, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
```

Limit: 50KB / 2000 lines. Always inform LLM when truncated.

## Custom Rendering

Tools can define `renderCall` and `renderResult` for TUI display:

```typescript
import { Text } from "@mariozechner/pi-tui";

renderCall(args, theme) {
  return new Text(theme.fg("toolTitle", theme.bold("my_tool ")) + theme.fg("muted", args.action), 0, 0);
},
renderResult(result, { expanded, isPartial }, theme) {
  if (isPartial) return new Text(theme.fg("warning", "Processing..."), 0, 0);
  return new Text(theme.fg("success", "✓ Done"), 0, 0);
}
```

Use `Text` with padding `(0, 0)` — the wrapping Box handles padding.

## Additional API

- `pi.registerShortcut("ctrl+shift+p", { handler })` — Keyboard shortcuts
- `pi.registerFlag("plan", { type: "boolean" })` — CLI flags
- `pi.exec("git", ["status"])` — Shell commands
- `pi.getActiveTools()` / `pi.setActiveTools(names)` — Manage tools
- `pi.setModel(model)` — Change model
- `pi.events` — Inter-extension event bus
- `pi.registerProvider("name", config)` — Custom model providers
- `pi.registerMessageRenderer("type", renderer)` — Custom message rendering

## Mode Behavior

| Mode | UI | Notes |
| --- | --- | --- |
| Interactive | Full TUI | Normal |
| RPC (`--mode rpc`) | JSON protocol | Host handles UI |
| JSON (`--mode json`) | No-op | Event stream |
| Print (`-p`) | No-op | Can't prompt |

Check `ctx.hasUI` before using UI methods in non-interactive modes.

## Detailed References

- [references/events.md](references/events.md) — Full event list with typed signatures and return values
- [references/examples.md](references/examples.md) — Categorized example index with key APIs used
- [references/sdk-ai.md](references/sdk-ai.md) — `@mariozechner/pi-ai` SDK: unified LLM API, models, providers, streaming, tools, thinking
- [references/sdk-agent.md](references/sdk-agent.md) — `@mariozechner/pi-agent-core` SDK: stateful agent, event flow, steering, custom message types
