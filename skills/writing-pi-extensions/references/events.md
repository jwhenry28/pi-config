# Extension Events Reference

## Table of Contents

- [Session Events](#session-events)
- [Agent Events](#agent-events)
- [Model Events](#model-events)
- [Tool Events](#tool-events)
- [User Bash Events](#user-bash-events)
- [Input Events](#input-events)

## Session Events

### session_start

Fired on initial session load.

```typescript
pi.on("session_start", async (_event, ctx) => {});
```

### session_before_switch / session_switch

Fired on `/new` or `/resume`. `session_before_switch` can cancel.

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  // event.reason - "new" | "resume"
  // event.targetSessionFile - only for "resume"
  return { cancel: true }; // optional
});

pi.on("session_switch", async (event, ctx) => {
  // event.reason, event.previousSessionFile
});
```

### session_before_fork / session_fork

Fired on `/fork`.

```typescript
pi.on("session_before_fork", async (event, ctx) => {
  // event.entryId
  return { cancel: true }; // or { skipConversationRestore: true }
});

pi.on("session_fork", async (event, ctx) => {
  // event.previousSessionFile
});
```

### session_before_compact / session_compact

Fired on compaction.

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, signal } = event;
  return { cancel: true };
  // OR custom:
  return {
    compaction: {
      summary: "...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
    },
  };
});

pi.on("session_compact", async (event, ctx) => {
  // event.compactionEntry, event.fromExtension
});
```

### session_before_tree / session_tree

Fired on `/tree` navigation.

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  return { cancel: true }; // or { summary: { summary: "...", details: {} } }
});

pi.on("session_tree", async (event, ctx) => {
  // event.newLeafId, event.oldLeafId, event.summaryEntry, event.fromExtension
});
```

### session_shutdown

Fired on exit.

```typescript
pi.on("session_shutdown", async (_event, ctx) => {});
```

## Agent Events

### before_agent_start

Fired after user submits prompt, before agent loop. Can inject message and modify system prompt.

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  // event.prompt, event.images, event.systemPrompt
  return {
    message: { customType: "my-ext", content: "Context", display: true },
    systemPrompt: event.systemPrompt + "\nExtra instructions",
  };
});
```

### agent_start / agent_end

```typescript
pi.on("agent_start", async (_event, ctx) => {});
pi.on("agent_end", async (event, ctx) => {
  // event.messages
});
```

### turn_start / turn_end

One LLM response + tool calls.

```typescript
pi.on("turn_start", async (event, ctx) => {
  // event.turnIndex, event.timestamp
});
pi.on("turn_end", async (event, ctx) => {
  // event.turnIndex, event.message, event.toolResults
});
```

### message_start / message_update / message_end

```typescript
pi.on("message_start", async (event, ctx) => { /* event.message */ });
pi.on("message_update", async (event, ctx) => { /* event.message, event.assistantMessageEvent */ });
pi.on("message_end", async (event, ctx) => { /* event.message */ });
```

### context

Fired before each LLM call. Modify messages (deep copy, safe to mutate).

```typescript
pi.on("context", async (event, ctx) => {
  return { messages: event.messages.filter((m) => !shouldPrune(m)) };
});
```

## Model Events

### model_select

Fired on model change via `/model`, `Ctrl+P`, or session restore.

```typescript
pi.on("model_select", async (event, ctx) => {
  // event.model, event.previousModel, event.source ("set" | "cycle" | "restore")
});
```

## Tool Events

### tool_call

Fired before tool executes. **Can block.** Use `isToolCallEventType` to narrow types.

```typescript
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";

pi.on("tool_call", async (event, ctx) => {
  if (isToolCallEventType("bash", event)) {
    // event.input is { command: string; timeout?: number }
    if (event.input.command.includes("rm -rf")) {
      return { block: true, reason: "Dangerous" };
    }
  }
});
```

### tool_result

Fired after tool executes. **Can modify result.** Handlers chain in load order.

```typescript
import { isBashToolResult } from "@mariozechner/pi-coding-agent";

pi.on("tool_result", async (event, ctx) => {
  // event.toolName, event.toolCallId, event.input, event.content, event.details, event.isError
  return { content: [...], details: {...}, isError: false }; // partial patches OK
});
```

### tool_execution_start / tool_execution_update / tool_execution_end

```typescript
pi.on("tool_execution_start", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.args
});
pi.on("tool_execution_end", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.result, event.isError
});
```

## User Bash Events

### user_bash

Fired on `!` or `!!` commands. Can intercept.

```typescript
pi.on("user_bash", (event, ctx) => {
  // event.command, event.excludeFromContext, event.cwd
  return { operations: remoteBashOps }; // or { result: { output, exitCode, cancelled, truncated } }
});
```

## Input Events

### input

Fired after extension commands checked, before skill/template expansion.

```typescript
pi.on("input", async (event, ctx) => {
  // event.text, event.images, event.source ("interactive" | "rpc" | "extension")
  return { action: "transform", text: "modified" }; // or "handled" or "continue"
});
```
