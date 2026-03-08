---
name: writing-pi-tests
description: Use when writing or reviewing unit tests for pi extensions — covers test utilities, store isolation, mocking ExecutionContext and ExtensionAPI, and vitest patterns
module: pi-development
---

# Writing Pi Extension Tests

Unit tests for pi extensions using vitest and the shared `testutils` package.

## Project Setup

- Test runner: **vitest** (config in `vitest.config.ts`)
- Test location: `<extension>/__tests__/<module>.test.ts`
- Shared utilities: `.pi/extensions/testutils/index.ts`

## Test Utilities

Import from `../../testutils/index.js` (relative paths only — no `@` aliases, since pi loads extensions directly).

### `makeStoreName(prefix)`

Returns a unique store name for test isolation. Always pass a prefix identifying the extension, e.g. `"test-todo-"`.

### `purgeStore(cwd, store)`

Deletes a store file if it exists. Use in `afterEach` to clean up.

### `makeMockTex(cwd, storeName, options?)`

Creates a mock execution context matching the `{ cwd, storeName, ui }` shape. Returns `{ tex, notifications }`.

- `notifications` captures all `ui.notify(msg, level)` calls
- Override `confirm` via `options.confirm`

```typescript
const { tex, notifications } = makeMockTex(cwd, store, {
  confirm: async () => true,
});
```

### `makeMockPi()`

Creates a mock `ExtensionAPI`. Returns `{ pi, messages }`.

- `messages.sent` captures `pi.sendMessage()` calls
- `messages.userMessages` captures `pi.sendUserMessage()` calls

```typescript
const { pi, messages } = makeMockPi();
// ... call handler ...
expect(messages.sent[0].customType).toBe("todo:skill");
expect(messages.userMessages[0]).toContain("my-task");
```

## Key Patterns

### Store Isolation

Every test gets its own store via `makeStoreName`. Track stores for cleanup:

```typescript
const stores: string[] = [];

afterEach(() => {
  for (const store of stores) purgeStore(cwd, store);
  stores.length = 0;
});

it("does something", async () => {
  const store = makeStoreName("test-todo-");
  stores.push(store);
  // ...
});
```

### ExecutionContext Pattern

Handlers accept a single `*ExecutionContext` object (e.g. `TodoExecutionContext`) instead of `(ctx: ExtensionCommandContext, storeName: string)`. This bundles `cwd`, `storeName`, and `ui` — making both production wiring and test mocking clean.

Define the type in the extension's `constants.ts`:

```typescript
export interface TodoUI {
  notify: (msg: string, level: string) => void;
  confirm: (title: string, msg: string) => Promise<boolean>;
}

export interface TodoExecutionContext {
  cwd: string;
  storeName: string;
  ui: TodoUI;
}
```

Production code in `index.ts` constructs it from the pi `ctx`:

```typescript
const tex: TodoExecutionContext = { cwd: ctx.cwd, storeName: TODO_STORE, ui: ctx.ui };
await handleAdd(parts, tex);
```

### Clearing Notifications Mid-Test

When a test calls multiple handlers sequentially, clear `notifications.length = 0` between calls to isolate assertions.

### Testing Tool Execute Functions

Extract the tool's core logic into a standalone function with a `storeName` parameter:

```typescript
export function executeTodoList(cwd: string, storeName?: string) {
  const result = formatTodoList(cwd, storeName);
  return { content: [{ type: "text" as const, text: result ?? "No open todos." }] };
}
```

The `registerTool` wrapper calls this, and tests invoke it directly.

### File Cleanup

For handlers that create files, track paths and clean up in `afterEach`:

```typescript
const filesToClean: string[] = [];

afterEach(() => {
  for (const f of filesToClean) {
    if (existsSync(f)) unlinkSync(f);
  }
  filesToClean.length = 0;
});
```

## Fixture Writers

Import from `../../testutils/fixtures.js` (or re-exported from `../../testutils/component/index.js`).

All writers handle `mkdirSync` internally — never call `mkdirSync` manually in tests.

| Function | Writes to |
|----------|-----------|
| `writeSkill(cwd, name, content)` | `.pi/skills/<name>/SKILL.md` |
| `writeWrapper(cwd, name, symlink, module?)` | `.pi/skills/<name>/WRAPPER.md` |
| `writeWorkflow(cwd, name, config)` | `.pi/workflows/<name>.yml` |
| `writeConfigFile(cwd, filename, content)` | `.pi/configs/<filename>` |
| `writePluginDir(cwd, name, files?)` | `.pi/plugins/<name>/...` |
| `writeTodo(cwd, filepath, items)` | `<cwd>/<filepath>` |
| `writeFile(cwd, relativePath, content)` | `<cwd>/<relativePath>` |

## Component Tests (Full Agent Loop)

Component tests exercise slash commands and agent tool calls against a real `AgentSession` with a mocked LLM. Import from `../../testutils/component/index.js`.

### CWD Architecture

`createComponentTest` separates **extension discovery** from **data I/O**:

- **Discovery** always uses the real project root (`process.cwd()`), passed to `createAgentSession`. Extensions are found at `.pi/extensions/` in the actual repo.
- **Data I/O** is redirected via `setCwdOverride()` (from `shared/cwd.ts`) to an isolated directory. All extensions use `getCwd(ctx)` instead of `ctx.cwd` directly, so their reads/writes go to the override path.

`createComponentTest()` always creates its own temp dir automatically. There is no `cwd` option — the harness manages the temp dir lifecycle internally, cleaning it up in `dispose()`.

**`test.cwd`** always points to the isolated data directory (not the project root). Use it for file assertions:

```typescript
expect(existsSync(join(test.cwd, "todos", "my-task.md"))).toBe(true);
```

### Tests That Need Skills at Session Start

Skills must exist before `bindExtensions` because `session_start → loadAllSkills` fires during binding. Use the `initialSkills` option:

```typescript
test = await createComponentTest({
  initialSkills: [{ name: "my-skill", content: "---\nname: my-skill\ndescription: Test skill\n---\n# My Skill" }],
});
```

### Other Initial Fixtures

`createComponentTest` supports additional fixture options, all written before `bindExtensions`:

```typescript
test = await createComponentTest({
  initialSkills: [{ name: "my-skill", content: "..." }],
  initialWrappers: [{ name: "my-wrapper", symlink: "@/repo/skill", module: "dev" }],
  initialConfigs: [{ filename: "test.yml", content: yamlContent }],
  initialPlugins: [{ name: "my-repo", files: [{ path: "README.md", content: "# test" }] }],
  initialWorkflows: [{ name: "my-flow", config: { name: "my-flow", steps: [] } }],
  initialTodos: [{ filepath: "todo.md", items: [{ text: "Task A", checked: false }] }],
});
```

For non-skill fixtures that are read on-demand by commands, use fixture writers from `testutils/fixtures.ts` (re-exported from `testutils/component/index.js`):

```typescript
import { createComponentTest, writeConfigFile, writeWorkflow } from "../../testutils/component/index.js";

test = await createComponentTest();
writeConfigFile(test.cwd, "test.yml", content);
writeWorkflow(test.cwd, "my-flow", config);
```

Cleanup is handled by `test.dispose()` — no manual `rmSync` needed.

### API

```typescript
const test = await createComponentTest({ shownModules: ["agent-todo"] });

// sendUserMessage — fire-and-forget, never awaited
test.sendUserMessage("/todo add task-a Do the thing");

// runCommand — awaitable, for slash commands that may trigger agent turns internally
await test.runCommand("/todo design my-task");

// mockAgentResponse — await it; resolves when response is consumed (tools executed)
await test.mockAgentResponse({ toolCalls: [{ name: "todo_list", args: {} }] });

// Assert between mock responses — tools have already run
expect(test.events.toolResults().length).toBeGreaterThanOrEqual(1);

// Final text response + wait for agent loop to wind down
await test.mockAgentResponse({ text: "Done." });
await test.waitForIdle();

// Cleanup
test.dispose();
```

### Key Rules

- **`sendUserMessage`** is synchronous (not awaited). Slash commands execute inline; LLM prompts start the agent loop which blocks until `mockAgentResponse` provides a response.
- **`runCommand`** is awaitable. Use for slash commands that internally call `pi.sendUserMessage()` or `pi.sendMessage()`. Any agent turns triggered by the command auto-complete with empty responses so you don't need `mockAgentResponse`. Assert on `test.events` and `test.notifications` after it resolves.
- **`mockAgentResponse`** is always awaited. It waits for the agent to call `streamFn`, delivers the response, then waits for consumption (next `streamFn` call or idle). After it resolves, tool calls have executed and events are available.
- **`waitForIdle`** drains the agent loop and event queue. Call after the last `mockAgentResponse`.
- **Simple slash commands** (no internal `pi.sendUserMessage`) work with either `sendUserMessage` or `runCommand`. Use `sendUserMessage` for brevity.
- **Slash commands that trigger agent turns** (e.g. calling `pi.sendUserMessage` internally) **must use `runCommand`** — otherwise you'd have to manually satisfy the agent turn with `mockAgentResponse`.
- **`shownModules`** is required when testing agent tool calls, so module filtering doesn't hide tools.
- **`test.notifications`** captures all `ui.notify()` calls. **`test.events`** captures agent events — use `.toolCalls()`, `.toolResults()`, `.customMessages()`, `.ofType()`.
- Always call `test.dispose()` in `afterEach`.

### Conversation Flow for Tool Call Tests

```
sendUserMessage("natural language prompt")     ← starts agent loop, blocks at streamFn
  mockAgentResponse({ toolCalls: [...] })      ← agent "decides" to call tool, framework executes it
  // assert on tool results here
  mockAgentResponse({ text: "summary" })       ← agent summarizes, loop ends
  waitForIdle()                                ← drain events
```

### Slash Command That Triggers Agent Turn

```
runCommand("/todo design my-task")             ← runs command, auto-completes any agent turns
  // assert on events and notifications here
  test.events.customMessages("todo:skill")     ← custom messages from pi.sendMessage()
```

### Event Helpers

`test.events` provides typed helpers for common assertions:

- **`.toolCalls()`** — `{ toolName, args }[]` from `tool_execution_start` events
- **`.toolResults()`** — `{ toolName, result, isError }[]` from `tool_execution_end` events
- **`.customMessages(customType?)`** — `{ customType, content, details }[]` from `message_start` events with `role: "custom"`. Optionally filter by `customType`.
- **`.ofType(type)`** — raw events filtered by event type string
- **`.all`** — all collected events
- **`.clear()`** — reset collected events (useful between setup and assertions)

```typescript
// Assert a custom message was injected
const skills = test.events.customMessages("todo:skill");
expect(skills).toHaveLength(1);
expect(skills[0].content).toContain("brainstorming");
expect(skills[0].details).toEqual(expect.objectContaining({ skillName: "brainstorming" }));
```

## Testutils Is a Fake Extension

The `testutils/index.ts` exports a no-op default function so pi's extension loader doesn't error:

```typescript
export default function testutilsExtension(_pi: ExtensionAPI) {}
```

## Checklist

- [ ] Each test uses its own store via `makeStoreName`
- [ ] Stores cleaned up in `afterEach`
- [ ] Imports use relative paths, not aliases
- [ ] Handler accepts `*ExecutionContext`, not raw `ExtensionCommandContext`
- [ ] Notifications cleared between sequential handler calls
- [ ] Files created by handlers tracked and cleaned up
- [ ] Component tests: `sendUserMessage` not awaited, `mockAgentResponse` awaited
- [ ] Component tests: `runCommand` used for slash commands that trigger agent turns internally
- [ ] Component tests: `shownModules` set when testing agent tool calls
- [ ] Component tests: `dispose()` called in `afterEach`
- [ ] Fixtures written via testutils helpers (not manual mkdirSync/writeFileSync)
- [ ] Pre-session fixtures use `initialX` options on `createComponentTest`
- [ ] Mid-test fixtures use writers from `testutils/fixtures.ts`
