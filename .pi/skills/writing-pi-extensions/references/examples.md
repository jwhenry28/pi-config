# Extension Examples Reference

All examples at `examples/extensions/` in the pi-coding-agent package.

## Tools

| Example | Description | Key APIs |
| --- | --- | --- |
| `hello.ts` | Minimal tool | `registerTool` |
| `question.ts` | Tool with user interaction | `registerTool`, `ui.select` |
| `questionnaire.ts` | Multi-step wizard | `registerTool`, `ui.custom` |
| `todo.ts` | Stateful with persistence | `registerTool`, `appendEntry`, session events |
| `truncated-tool.ts` | Output truncation | `registerTool`, `truncateHead` |
| `tool-override.ts` | Override built-in read | `registerTool` (same name) |

## Commands

| Example | Description | Key APIs |
| --- | --- | --- |
| `pirate.ts` | Modify system prompt | `registerCommand`, `before_agent_start` |
| `summarize.ts` | Conversation summary | `registerCommand`, `ui.custom` |
| `handoff.ts` | Cross-provider handoff | `registerCommand`, `ui.editor` |
| `send-user-message.ts` | Inject user messages | `registerCommand`, `sendUserMessage` |
| `reload-runtime.ts` | Reload + LLM tool | `registerCommand`, `ctx.reload()` |
| `shutdown-command.ts` | Graceful shutdown | `registerCommand`, `shutdown()` |

## Events & Gates

| Example | Description | Key APIs |
| --- | --- | --- |
| `permission-gate.ts` | Block dangerous commands | `on("tool_call")`, `ui.confirm` |
| `protected-paths.ts` | Block writes to paths | `on("tool_call")` |
| `input-transform.ts` | Transform user input | `on("input")` |
| `model-status.ts` | React to model changes | `on("model_select")`, `setStatus` |
| `claude-rules.ts` | Load rules from files | `on("session_start")`, `on("before_agent_start")` |

## UI Components

| Example | Description | Key APIs |
| --- | --- | --- |
| `status-line.ts` | Footer status | `setStatus` |
| `custom-footer.ts` | Replace footer | `setFooter` |
| `modal-editor.ts` | Vim-style editor | `setEditorComponent`, `CustomEditor` |
| `widget-placement.ts` | Widget positioning | `setWidget` |
| `overlay-test.ts` | Overlay components | `ui.custom` with overlay |
| `timed-confirm.ts` | Dialog with timeout | `ui.confirm` with timeout |

## Complex Extensions

| Example | Description | Key APIs |
| --- | --- | --- |
| `plan-mode/` | Full plan mode | All event types, commands, shortcuts, flags, widgets |
| `preset.ts` | Saveable presets | `setModel`, `setActiveTools`, `setThinkingLevel`, `appendEntry` |
| `ssh.ts` | SSH remote execution | `registerFlag`, `on("user_bash")`, tool operations |

## Providers

| Example | Description | Key APIs |
| --- | --- | --- |
| `custom-provider-anthropic/` | Custom Anthropic proxy | `registerProvider` |
| `custom-provider-gitlab-duo/` | GitLab Duo + OAuth | `registerProvider` with OAuth |
