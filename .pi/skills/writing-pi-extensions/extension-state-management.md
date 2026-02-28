# Extension State Management

State in extensions must survive session branching, switching, and tree navigation. Store snapshots in tool result `details` and reconstruct from the session branch on lifecycle events.

## Pattern

```typescript
export default function (pi: ExtensionAPI) {
  let items: string[] = [];

  const reconstructState = (ctx: ExtensionContext) => {
    items = [];
    // Scan session history for previous tool results
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "message") continue;
      if (
        entry.message.role !== "toolResult" ||
        entry.message.toolName !== "my_tool"
      )
        continue;
      // Restore from last result
      items = entry.message.details?.items ?? [];
    }
  };

  // Restore state on session events
  pi.on("session_start", async (_e, ctx) => reconstructState(ctx));
  pi.on("session_switch", async (_e, ctx) => reconstructState(ctx));
  pi.on("session_fork", async (_e, ctx) => reconstructState(ctx));
  pi.on("session_tree", async (_e, ctx) => reconstructState(ctx));

  pi.registerTool({
    name: "my_tool",
    // ...
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // Mutate in-memory state
      items.push("new");

      // Return snapshot in details for reconstruction
      return {
        content: [{ type: "text", text: "Added" }],
        details: { items: [...items] },
      };
    },
  });
}
```

## Key Points

- **State lives in memory** during a session (in your extension function closure)
- **Snapshots go in `details`** of tool results — these persist across sessions
- **Reconstruct on every session event** (start, switch, fork, tree) by scanning `ctx.sessionManager.getBranch()`
- **Always snapshot the current state** when returning tool results
- Each branch rebuilds state independently from its own history
