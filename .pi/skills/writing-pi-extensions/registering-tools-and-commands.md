# Registering Tools and Commands

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

### Key Rules for Tools

- Use `StringEnum` for string enums (Google API breaks with `Type.Union`/`Type.Literal`)
- Use `pi.exec(cmd, args, opts)` for shell commands, NOT `child_process` or `fs` directly
- `pi.exec()` returns `{ stdout, stderr, code, killed }` — it does NOT throw. Check `result.code !== 0` for errors.
- Normalize leading `@` in path arguments (some models add it)
- Return `content` (for LLM) and `details` (for rendering/state)
- Truncate large output (see `output-truncation.md`)

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
