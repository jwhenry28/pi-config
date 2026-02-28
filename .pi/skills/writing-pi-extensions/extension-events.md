# Extension Events

Subscribe with `pi.on(eventName, handler)`. Key events and patterns:

## Blocking Tool Calls

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

## Session Lifecycle Events

Use these to reconstruct state when loading or switching branches:

```typescript
pi.on("session_start", async (_event, ctx) => reconstructState(ctx));
pi.on("session_switch", async (_event, ctx) => reconstructState(ctx));
pi.on("session_fork", async (_event, ctx) => reconstructState(ctx));
pi.on("session_tree", async (_event, ctx) => reconstructState(ctx));
```

See `extension-state-management.md` for state reconstruction patterns.

## Modifying System Prompt

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

## Modifying Context Before LLM Call

```typescript
pi.on("context", async (event, ctx) => {
  const filtered = event.messages.filter((m) => !shouldPrune(m));
  return { messages: filtered };
});
```
