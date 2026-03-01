---
name: writing-pi-extensions
description: Use when creating, modifying, or debugging extensions for the pi agentic coding framework - provides the correct API shape, imports, event system, tool registration, command registration, state management, and common patterns that differ significantly from what you might guess
module: pi-development
---

# Writing pi Extensions

## Overview

pi extensions are TypeScript modules that extend the pi coding agent. They use a **function-based API** where you export a default function receiving `ExtensionAPI`. Everything is wrong if you use class-based or object-based patterns.

**REQUIRED SUB-SKILLS:** 
- Extension structure & common mistakes: see `api-shape-and-imports`
- Tool/command registration: see `registering-tools-and-commands`
- Event handling system: see `extension-events`
- Session state management: see `extension-state-management`
- Testing with RPC: see `testing-pi-extensions-rpc`

## Critical: The Correct Shape

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // ALL registration happens here via pi.* methods
}
```

**There is no other shape.** No `Extension` class, no object with `name`/`version`, no `@anthropic/*` packages.

## Extension File Locations

| Location                            | Scope                        |
| ----------------------------------- | ---------------------------- |
| `~/.pi/agent/extensions/*.ts`       | Global (all projects)        |
| `~/.pi/agent/extensions/*/index.ts` | Global (subdirectory)        |
| `.pi/extensions/*.ts`               | Project-local                |
| `.pi/extensions/*/index.ts`         | Project-local (subdirectory) |

Test with: `pi -e ./my-extension.ts`

Auto-discovered extensions support `/reload` for hot-reloading.

## Registering Tools Under a Module

This project has a module system (`.pi/extensions/modules/`) that groups tools and skills into named modules that can be shown/hidden via `/module show <name>` and `/module hide <name>`. When a module is hidden, its tools are deactivated and its skills are filtered from the system prompt.

### Tagging a tool to a module

Import `moduleTag` from the modules extension and wrap your tool definition:

```typescript
import { moduleTag } from "./modules/api.js";
// For extensions outside .pi/extensions/, adjust the import path accordingly.

export default function (pi: ExtensionAPI) {
  pi.registerTool(moduleTag(pi, "my-module", {
    name: "my_tool",
    label: "My Tool",
    description: "...",
    parameters: Type.Object({ /* ... */ }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // ...
    },
  }));
}
```

`moduleTag(pi, moduleName, toolDef)` emits a `"module:tool-tag"` event on the shared event bus (`pi.events`) and returns the tool definition unchanged. The modules extension listens for these events to discover tool-to-module associations.

### How it works under the hood

- `moduleTag` fires synchronously during extension loading, so by the time the modules extension initializes, all tool tags are already collected.
- A module-level `Map` is **not** shared between extensions because jiti loads each extension with `moduleCache: false` (isolated module instances). The shared event bus (`pi.events`) is the correct cross-extension communication channel.
- Skills declare their module via `module: <name>` in their `SKILL.md` YAML frontmatter. Tools use `moduleTag()`.

### Associating a skill with a module

In the skill's `SKILL.md`, add a `module` field to the YAML frontmatter:

```yaml
---
name: my-skill
description: ...
module: my-module
---
```

When the module is hidden, the skill's `<skill>` block is stripped from the system prompt.

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

## Quick Reference: Full Extension Example

See the pi examples directory for working implementations. Key examples:

- `hello.ts` - Minimal tool
- `todo.ts` - Stateful tool with session branching
- `permission-gate.ts` - Blocking dangerous commands
- `pirate.ts` - System prompt modification
- `status-line.ts` - Footer status
- `plan-mode/` - Complex multi-feature extension
