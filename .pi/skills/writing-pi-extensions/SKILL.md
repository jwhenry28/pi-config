---
name: writing-pi-extensions
description: Use when creating, modifying, or debugging extensions for the pi agentic coding framework - provides the correct API shape, imports, event system, tool registration, command registration, state management, and common patterns that differ significantly from what you might guess
module: pi-development
---

# Writing pi Extensions

## Overview

pi extensions are TypeScript modules that extend the pi coding agent. They use a **function-based API** where you export a default function receiving `ExtensionAPI`. Everything is wrong if you use class-based or object-based patterns.

## Critical: The Correct Shape

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // ALL registration happens here via pi.* methods
}
```

**There is no other shape.** No `Extension` class, no object with `name`/`version`, no `@anthropic/*` packages.

## Available Imports

| Package                         | Use for                                                                                                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@mariozechner/pi-coding-agent` | `ExtensionAPI`, `ExtensionContext`, event types, `isToolCallEventType`, `isBashToolResult`, `truncateHead`, `truncateTail`, `DEFAULT_MAX_BYTES`, `DEFAULT_MAX_LINES`, `keyHint`, `CustomEditor`, `createBashTool`, `createReadTool` |
| `@sinclair/typebox`             | `Type` for tool parameter schemas                                                                                                                                                                                                   |
| `@mariozechner/pi-ai`           | `StringEnum` (required for enum params - Google API compatibility), `Type` (re-exported from typebox)                                                                                                                               |
| `@mariozechner/pi-tui`          | `Text`, `Component`, `matchesKey`, `truncateToWidth`, `Key` (for shortcuts: `Key.ctrlShift("s")`)                                                                                                                                   |
| `node:*`                        | Node.js built-ins (`node:fs`, `node:path`, etc.)                                                                                                                                                                                    |

## Extension File Locations

| Location                            | Scope                        |
| ----------------------------------- | ---------------------------- |
| `~/.pi/agent/extensions/*.ts`       | Global (all projects)        |
| `~/.pi/agent/extensions/*/index.ts` | Global (subdirectory)        |
| `.pi/extensions/*.ts`               | Project-local                |
| `.pi/extensions/*/index.ts`         | Project-local (subdirectory) |

Test with: `pi -e ./my-extension.ts`

Auto-discovered extensions support `/reload` for hot-reloading.

## Registering Tools

```typescript
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "Shown to LLM",
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const), // NOT Type.Union/Type.Literal
    path: Type.Optional(Type.String()),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Check cancellation
    if (signal?.aborted)
      return { content: [{ type: "text", text: "Cancelled" }] };

    // Stream progress
    onUpdate?.({ content: [{ type: "text", text: "Working..." }] });

    // Run shell commands via pi.exec (NOT child_process)
    const result = await pi.exec("find", [".", "-type", "f"], {
      signal,
      timeout: 5000,
    });

    return {
      content: [{ type: "text", text: "Done" }], // Sent to LLM
      details: { data: result.stdout }, // For rendering & state reconstruction
    };
  },
});
```

**Key rules:**

- Use `StringEnum` for string enums (Google API breaks with `Type.Union`/`Type.Literal`)
- Use `pi.exec(cmd, args, opts)` for shell commands, NOT `child_process` or `fs` directly
- `pi.exec()` returns `{ stdout, stderr, code, killed }` — it does NOT throw. Check `result.code !== 0` for errors.
- Normalize leading `@` in path arguments (some models add it)
- Return `content` (for LLM) and `details` (for rendering/state)
- Truncate large output (see Output Truncation below)

## Registering Commands

```typescript
pi.registerCommand("stats", {
  description: "Show statistics",
  handler: async (args, ctx) => {
    if (!ctx.hasUI) {
      ctx.ui.notify("Requires interactive mode", "error");
      return;
    }
    ctx.ui.notify(`Stats: ${args}`, "info");
  },
});
```

**Always check `ctx.hasUI`** before using UI methods. In print mode (`-p`) and JSON mode, UI methods are no-ops.

## Event Handling

Subscribe with `pi.on(eventName, handler)`. Key events:

### Blocking Tool Calls

```typescript
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";

pi.on("tool_call", async (event, ctx) => {
  if (isToolCallEventType("bash", event)) {
    if (event.input.command.includes("rm -rf /")) {
      return { block: true, reason: "Dangerous command blocked" };
    }
  }
});
```

### Session Lifecycle (for state reconstruction)

```typescript
pi.on("session_start", async (_event, ctx) => reconstructState(ctx));
pi.on("session_switch", async (_event, ctx) => reconstructState(ctx));
pi.on("session_fork", async (_event, ctx) => reconstructState(ctx));
pi.on("session_tree", async (_event, ctx) => reconstructState(ctx));
```

### Modifying System Prompt

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  return {
    systemPrompt: event.systemPrompt + "\n\nExtra instructions...",
    message: {
      customType: "my-ext",
      content: "Context for LLM",
      display: true,
    },
  };
});
```

### Modifying Context Before LLM Call

```typescript
pi.on("context", async (event, ctx) => {
  const filtered = event.messages.filter((m) => !shouldPrune(m));
  return { messages: filtered };
});
```

## State Management

Store state in tool result `details`. Reconstruct from session branch on load/switch/fork:

```typescript
export default function (pi: ExtensionAPI) {
  let items: string[] = [];

  const reconstructState = (ctx: ExtensionContext) => {
    items = [];
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "message") continue;
      if (
        entry.message.role !== "toolResult" ||
        entry.message.toolName !== "my_tool"
      )
        continue;
      items = entry.message.details?.items ?? [];
    }
  };

  pi.on("session_start", async (_e, ctx) => reconstructState(ctx));
  pi.on("session_switch", async (_e, ctx) => reconstructState(ctx));
  pi.on("session_fork", async (_e, ctx) => reconstructState(ctx));
  pi.on("session_tree", async (_e, ctx) => reconstructState(ctx));

  pi.registerTool({
    name: "my_tool",
    // ...
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      items.push("new");
      return {
        content: [{ type: "text", text: "Added" }],
        details: { items: [...items] }, // Snapshot for reconstruction
      };
    },
  });
}
```

## Output Truncation

Tools MUST truncate output to avoid context overflow. Built-in limit: 50KB / 2000 lines.

```typescript
import {
  truncateHead,
  truncateTail,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
} from "@mariozechner/pi-coding-agent";

const truncation = truncateHead(output, {
  maxLines: DEFAULT_MAX_LINES,
  maxBytes: DEFAULT_MAX_BYTES,
});
// Returns: { content, truncated, totalLines, outputLines, totalBytes, outputBytes }
let resultText = truncation.content; // The (possibly truncated) text
if (truncation.truncated) {
  resultText += `\n[Truncated: ${truncation.outputLines}/${truncation.totalLines} lines, ${formatSize(truncation.outputBytes)}/${formatSize(truncation.totalBytes)}]`;
}
```

## Custom Rendering

```typescript
import { Text } from "@mariozechner/pi-tui";

pi.registerTool({
  // ...
  renderCall(args, theme) {
    return new Text(
      theme.fg("toolTitle", theme.bold("my_tool ")) +
        theme.fg("muted", args.action),
      0,
      0,
    );
  },
  renderResult(result, { expanded, isPartial }, theme) {
    if (isPartial) return new Text(theme.fg("warning", "Working..."), 0, 0);
    return new Text(theme.fg("success", "✓ Done"), 0, 0);
  },
});
```

Use `Text` with padding `(0, 0)` - the outer Box handles padding.

## Other API Methods

| Method                                             | Purpose                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `pi.sendMessage(msg, opts)`                        | Inject message into session. `deliverAs`: `"steer"`, `"followUp"`, `"nextTurn"` |
| `pi.sendUserMessage(text, opts)`                   | Send as user message. Always triggers turn.                                     |
| `pi.appendEntry(type, data)`                       | Persist state outside LLM context                                               |
| `pi.registerShortcut(key, opts)`                   | Register keyboard shortcut                                                      |
| `pi.registerFlag(name, opts)`                      | Register CLI flag                                                               |
| `pi.getActiveTools()` / `pi.setActiveTools(names)` | Manage active tools                                                             |
| `pi.setModel(model)`                               | Switch model                                                                    |
| `pi.exec(cmd, args, opts)`                         | Execute shell command                                                           |
| `pi.events`                                        | Shared event bus between extensions                                             |
| `pi.registerProvider(name, config)`                | Register custom model provider                                                  |
| `pi.registerMessageRenderer(type, fn)`             | Custom message rendering                                                        |

## Common Mistakes

| Mistake                                       | Fix                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| Wrong package name (`@anthropic/*`, `pi-sdk`) | Use `@mariozechner/pi-coding-agent`                                         |
| Object/class-based extension                  | Use `export default function(pi: ExtensionAPI)`                             |
| `Type.Union`/`Type.Literal` for enums         | Use `StringEnum` from `@mariozechner/pi-ai`                                 |
| `child_process` / `fs.readFileSync`           | Use `pi.exec()` for commands, node:fs is OK for extension-internal file ops |
| No `ctx.hasUI` check before UI calls          | Always check in commands/handlers                                           |
| No state reconstruction on session events     | Handle `session_start`, `session_switch`, `session_fork`, `session_tree`    |
| No output truncation                          | Use `truncateHead`/`truncateTail` from pi-coding-agent                      |
| Returning result to block tool call           | Return `{ block: true, reason: "..." }` from `tool_call` handler            |
| `process.cwd()` for working dir               | Use `ctx.cwd`                                                               |
| try/catch around `pi.exec()`                  | `pi.exec()` doesn't throw — check `result.code !== 0` instead               |
| `parameters: {}` for no-param tools           | Use `parameters: Type.Object({})`                                           |

## Testing Extensions with RPC Mode

RPC mode (`pi --mode rpc`) is the **preferred method** for testing extensions against a fresh pi instance. This lets pi test itself — spawn a headless pi subprocess, send prompts, and assert on behavior.

### Starting an RPC Test Instance

```bash
pi --mode rpc --no-session -e ./my-extension.ts
```

- `--mode rpc`: Headless JSON-over-stdin/stdout protocol
- `--no-session`: Don't persist session (clean test)
- `-e ./my-extension.ts`: Load the extension under test

### Protocol Basics

- **Send commands**: Write JSON to stdin (one per line)
- **Read events**: Parse JSON lines from stdout
- Commands support optional `id` for request/response correlation

### Key Commands

| Command | Purpose |
|---------|---------|
| `{"type": "prompt", "message": "..."}` | Send user prompt |
| `{"type": "steer", "message": "..."}` | Interrupt mid-run |
| `{"type": "follow_up", "message": "..."}` | Queue for after completion |
| `{"type": "abort"}` | Cancel current operation |
| `{"type": "get_state"}` | Get session state (model, streaming status, etc.) |
| `{"type": "get_messages"}` | Get all conversation messages |
| `{"type": "bash", "command": "..."}` | Run shell command (output included in next prompt's context) |
| `{"type": "new_session"}` | Fresh session |

### Key Events (stdout)

| Event | When |
|-------|------|
| `agent_start` / `agent_end` | Agent begins/finishes processing |
| `message_update` | Streaming text/thinking/tool-call deltas |
| `tool_execution_start` / `tool_execution_end` | Tool runs (check `toolName`, `args`, `result`) |
| `extension_error` | Extension threw an error |

### Minimal Python Test

```python
import subprocess, json

proc = subprocess.Popen(
    ["pi", "--mode", "rpc", "--no-session", "-e", "./my-extension.ts"],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True
)

def send(cmd):
    proc.stdin.write(json.dumps(cmd) + "\n")
    proc.stdin.flush()

def read_until(event_type):
    for line in proc.stdout:
        event = json.loads(line)
        if event.get("type") == event_type:
            return event

send({"type": "prompt", "message": "Use my_tool to list items"})
end = read_until("agent_end")
# Assert on end["messages"], tool calls, etc.
```

### Minimal Node.js Test

```javascript
const { spawn } = require("child_process");
const readline = require("readline");

const agent = spawn("pi", ["--mode", "rpc", "--no-session", "-e", "./my-extension.ts"]);

const send = (cmd) => agent.stdin.write(JSON.stringify(cmd) + "\n");

readline.createInterface({ input: agent.stdout }).on("line", (line) => {
    const event = JSON.parse(line);
    if (event.type === "tool_execution_end" && event.toolName === "my_tool") {
        console.log("Tool result:", event.result);
    }
    if (event.type === "agent_end") {
        agent.kill();
    }
});

send({ type: "prompt", message: "Use my_tool to list items" });
```

### Streaming Behavior During Tests

- If the agent is already streaming, `prompt` requires `streamingBehavior: "steer"` or `"followUp"` — otherwise it errors
- Extension commands (e.g., `/mycommand`) execute immediately even during streaming
- Use `steer` to interrupt mid-run; use `follow_up` to queue after completion

### Extension UI in RPC Mode

Extensions using `ctx.ui.select()`, `ctx.ui.confirm()`, etc. emit `extension_ui_request` events. Your test client must respond with matching `extension_ui_response` commands:

```json
// Request (stdout):
{"type": "extension_ui_request", "id": "uuid-1", "method": "select", "title": "Allow?", "options": ["Allow", "Block"]}

// Response (stdin):
{"type": "extension_ui_response", "id": "uuid-1", "value": "Allow"}
```

Fire-and-forget methods (`notify`, `setStatus`, `setWidget`, `setTitle`) need no response.

**Note:** `ctx.hasUI` is `true` in RPC mode. Methods requiring direct TUI access (`custom()`, `setFooter()`, `setHeader()`, etc.) are no-ops or return defaults.

### For Node.js/TypeScript: Direct `AgentSession` API

If your test is in Node.js/TypeScript, you can skip subprocess spawning and use `AgentSession` directly from `@mariozechner/pi-coding-agent`. See `src/core/agent-session.ts` in the pi source. For subprocess-based TypeScript, see `src/modes/rpc/rpc-client.ts`.

### Full RPC Reference

The complete RPC protocol documentation (all commands, events, types, extension UI sub-protocol) is at:
`https://raw.githubusercontent.com/badlogic/pi-mono/refs/heads/main/packages/coding-agent/docs/rpc.md`

## Quick Reference: Full Extension Example

See the pi examples directory for working implementations. Key examples:

- `hello.ts` - Minimal tool
- `todo.ts` - Stateful tool with session branching
- `permission-gate.ts` - Blocking dangerous commands
- `pirate.ts` - System prompt modification
- `status-line.ts` - Footer status
- `plan-mode/` - Complex multi-feature extension
