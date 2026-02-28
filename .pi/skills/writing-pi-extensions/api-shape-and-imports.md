# API Shape and Imports

## The Correct Shape

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

## Common Mistakes

| Mistake                                       | Fix                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| Wrong package name (`@anthropic/*`, `pi-sdk`) | Use `@mariozechner/pi-coding-agent`                                         |
| Object/class-based extension                  | Use `export default function(pi: ExtensionAPI)`                             |
| `Type.Union`/`Type.Literal` for enums         | Use `StringEnum` from `@mariozechner/pi-ai`                                 |
| `child_process` / `fs.readFileSync`           | Use `pi.exec()` for commands, node:fs is OK for extension-internal file ops |
| No `ctx.hasUI` check before UI calls          | Always check in commands/handlers                                           |
| `process.cwd()` for working dir               | Use `ctx.cwd`                                                               |
| try/catch around `pi.exec()`                  | `pi.exec()` doesn't throw — check `result.code !== 0` instead               |
| `parameters: {}` for no-param tools           | Use `parameters: Type.Object({})`                                           |
