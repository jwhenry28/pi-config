---
name: programming-debug-scripts
description: Use when writing, editing, or running .dbgscript files for headless game simulation - provides the script syntax, available commands, parameter formats, how to run scripts, and where to add new commands
module: genesis
---

# Debug Scripts

## Overview

Debug scripts (`.dbgscript`) drive headless game simulations — spawn entities, advance frames, capture screenshots — without manual play. Parsed by `DebugScriptParser`, executed by `GameSimulation`.

## Running a Script

```bash
dotnet run --project genesis -- --debug-script path/to/script.dbgscript
```

Screenshots are saved to `screenshots/`.

## Syntax

One command per line. Parameters use `key='value'` format (single-quoted). Blank lines and `#` comments are ignored.

## Command Reference

| Command | Parameters | Example |
|---------|-----------|---------|
| `spawn fauna` | `name` (required), `position` (required) | `spawn fauna name='wolf' position='(200, 300)'` |
| `advance` | `frames` (required), `duration` (optional, default `16.67`ms) | `advance frames='300' duration='33.33'` |
| `click` | `position` (required), `type` (optional, default `screen`) | `click position='(200, 300)' type='world'` |
| `query` | `type` (required), `name` (optional), `verbose` (optional, default `0`) | `query type='flora' name='LoamPlant' verbose='1'` |
| `screenshot` | `position` (required), `name` (optional) | `screenshot position='(200, 300)' name='result'` |

**Type (query):** Entity type to search for. One of: `flora`, `fauna`, `ecosystem`, `mineral`, `creature`, `entity`. Case-insensitive.

**Name (query):** Optional case-insensitive exact match filter on entity name.

**Verbose (query):** `0` = count only (default), `1` = count + names, `2` = count + names + positions.

**Position format:** `(x, y)` — e.g. `'(100, 250.5)'`

**Duration:** Milliseconds per frame. Default `16.67` ≈ 60fps.

**Type (click):** `screen` (raw pixel coordinates) or `world` (game world coordinates, converted to screen via `Camera.WorldToScreen`). Default `screen`.

## Example Script

```
# Spawn two creatures and observe interaction
spawn fauna name='predator' position='(200, 200)'
spawn fauna name='prey' position='(250, 200)'

# Simulate 5 seconds at 60fps
advance frames='300'

# Capture the result
screenshot position='(225, 200)' name='interaction_test'
```

## Line Numbers

Every `DebugCommand` carries a `LineNumber` property (1-indexed) set by the parser. Hand-constructed commands default to `0`.

The `query` command prefixes its output with the line number when available:
```
[line 11]: query flora: found 18 entities
```

When `LineNumber` is `0` (hand-constructed in tests), the prefix is omitted:
```
query flora: found 18 entities
```

## Architecture

```
genesis/src/simulation/
├── commands/DebugCommand.cs      # Base class (LineNumber) + command classes: SpawnFaunaCommand, AdvanceCommand, ClickCommand, QueryCommand, ScreenshotCommand
├── parser/DebugScriptParser.cs   # Text → List<DebugCommand> (pure, no MonoGame dependency)
├── parser/DebugScriptParseException.cs
├── SimulationScript.cs           # Static execute methods: ExecuteSpawnFauna, ExecuteAdvance, ExecuteClick, ExecuteQuery
└── GameSimulation.cs             # GameSimulation : Game1 — orchestrates parse + execute + screenshot + query
```

`Program.cs` routes `--debug-script <path>` → `GameSimulation.RunScript()`.

**Query output:** `ExecuteQuery` writes to `Console.Out` (or an injected `TextWriter` for testing) — not the diagnostic logger. This is intentional: query output is the command's primary purpose, distinct from diagnostic logging.

## Adding a New Command

1. Add a new class extending `DebugCommand` in `commands/DebugCommand.cs` — accept `int lineNumber = 0` and pass to `base(lineNumber)`
2. Add a `Parse___Command` method in `parser/DebugScriptParser.cs` and wire it into the keyword switch — pass `lineNumber` to the command constructor
3. Add a `Execute___` method in `SimulationScript.cs` (if pure logic) or handle in `GameSimulation.RunScript` (if needs graphics)
4. Add the new case to the `switch` in `GameSimulation.RunScript()`

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgetting quotes around values | All values must be single-quoted: `frames='300'` not `frames=300` |
| Wrong position format | Use `'(x, y)'` with parentheses and comma |
| Screenshot without advance | Nothing will have changed — add `advance` before `screenshot` |
| Putting graphics logic in `SimulationScript` | `SimulationScript` is pure (testable). Graphics-dependent logic goes in `GameSimulation` |
