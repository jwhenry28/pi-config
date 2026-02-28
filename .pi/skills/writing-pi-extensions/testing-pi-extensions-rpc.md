---
name: testing-pi-extensions-rpc
description: Use when testing pi extensions - RPC mode spawns a headless pi instance for automated testing against real agent behavior
module: pi-development
---

# Testing pi Extensions with RPC Mode

RPC mode (`pi --mode rpc`) is the **preferred method** for testing extensions against a fresh pi instance. This lets pi test itself — spawn a headless pi subprocess, send prompts, and assert on behavior.

## Starting an RPC Test Instance

```bash
pi --mode rpc --no-session -e ./my-extension.ts
```

- `--mode rpc`: Headless JSON-over-stdin/stdout protocol
- `--no-session`: Don't persist session (clean test)
- `-e ./my-extension.ts`: Load the extension under test

## Protocol Basics

- **Send commands**: Write JSON to stdin (one per line)
- **Read events**: Parse JSON lines from stdout
- Commands support optional `id` for request/response correlation

## Key Commands

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

## Key Events (stdout)

| Event | When |
|-------|------|
| `agent_start` / `agent_end` | Agent begins/finishes processing |
| `message_update` | Streaming text/thinking/tool-call deltas |
| `tool_execution_start` / `tool_execution_end` | Tool runs (check `toolName`, `args`, `result`) |
| `extension_error` | Extension threw an error |

## Minimal Python Test

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

## Minimal Node.js Test

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

## Streaming Behavior During Tests

- If the agent is already streaming, `prompt` requires `streamingBehavior: "steer"` or `"followUp"` — otherwise it errors
- Extension commands (e.g., `/mycommand`) execute immediately even during streaming
- Use `steer` to interrupt mid-run; use `follow_up` to queue after completion

## Extension UI in RPC Mode

Extensions using `ctx.ui.select()`, `ctx.ui.confirm()`, etc. emit `extension_ui_request` events. Your test client must respond with matching `extension_ui_response` commands:

```json
// Request (stdout):
{"type": "extension_ui_request", "id": "uuid-1", "method": "select", "title": "Allow?", "options": ["Allow", "Block"]}

// Response (stdin):
{"type": "extension_ui_response", "id": "uuid-1", "value": "Allow"}
```

Fire-and-forget methods (`notify`, `setStatus`, `setWidget`, `setTitle`) need no response.

**Note:** `ctx.hasUI` is `true` in RPC mode. Methods requiring direct TUI access (`custom()`, `setFooter()`, `setHeader()`, etc.) are no-ops or return defaults.

## Direct AgentSession API (Node.js/TypeScript)

If your test is in Node.js/TypeScript, you can skip subprocess spawning and use `AgentSession` directly from `@mariozechner/pi-coding-agent`. See `src/core/agent-session.ts` in the pi source. For subprocess-based TypeScript, see `src/modes/rpc/rpc-client.ts`.

## Full RPC Reference

The complete RPC protocol documentation (all commands, events, types, extension UI sub-protocol) is at:
`https://raw.githubusercontent.com/badlogic/pi-mono/refs/heads/main/packages/coding-agent/docs/rpc.md`
