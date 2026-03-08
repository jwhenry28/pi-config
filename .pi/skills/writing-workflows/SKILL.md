---
name: writing-workflows
description: Writing workflow YAML files for the /workflow extension - covers schema, step configuration, prompt references, conditions, commands, and execution model
---

# Writing Workflows

Workflows are YAML files in `.pi/workflows/` that define a sequence of steps executed by the `/workflow` extension. Each step runs in a fresh pi session with its own model, prompt, and skills.

## Usage

```
/workflow <name> <prompt>
```

`<name>` matches a file in `.pi/workflows/<name>.yml`. `<prompt>` is the top-level goal passed to every step.

## Schema

```yaml
name: My Workflow
modules:
  - development
steps:
  - name: Plan
    model: smart
    prompt: |
      Analyze the codebase and create a detailed plan.
    skills:
      - brainstorming
    modules:
      - testing
    approval: true

  - name: Implement
    model: general
    prompt: @prompts/implement.md
    skills:
      - executing-plans
    conditions:
      - command: check-todos-complete
        args:
          memoryKey: plan-todo
        jump: Implement

  - name: Quick Check
    command: check-todos-complete
    args:
      memoryKey: plan-todo
```

## Step Types

There are two mutually exclusive step types: **prompt steps** (LLM-driven) and **command steps** (deterministic code).

### Prompt Steps

| Field | Required | Default | Description |
| --- | --- | --- | --- |
| `name` | Yes | — | Display name shown in the TUI status bar |
| `model` | Yes | — | Model ID or alias (`smart`, `general`, `fast`) |
| `prompt` | Yes | — | Inline text or `@path` to a markdown file |
| `skills` | No | `[]` | Skill names to inject into the step |
| `modules` | No | — | Module names to activate (merged with workflow-level) |
| `approval` | No | `false` | Require `/workflow continue` before advancing |
| `maxExecutions` | No | `10` | Max times this step can be entered via conditional jump (loop guard) |
| `conditions` | No | — | Post-step conditions to evaluate (see below) |

### Command Steps

Run a registered TypeScript function directly — no LLM involved.

| Field | Required | Default | Description |
| --- | --- | --- | --- |
| `name` | Yes | — | Display name |
| `command` | Yes | — | Registered command name |
| `args` | No | — | Key-value string arguments passed to the command |
| `maxExecutions` | No | `10` | Max times this step can be entered via conditional jump (loop guard) |
| `conditions` | No | — | Post-step conditions to evaluate |

Command steps cannot have `model`, `prompt`, `skills`, `modules`, or `approval`.

## MaxExecutions (Loop Guard)

Each step has an optional `maxExecutions` field (default: `10`). Before a conditional jump targets a step, the workflow engine checks if that step has already been executed `maxExecutions` times. If so, the jump is skipped and the workflow advances sequentially instead.

This prevents infinite loops when conditions always match. Sequential advancement (non-jump) does **not** check `maxExecutions`.

```yaml
steps:
  - name: Implement
    model: general
    maxExecutions: 5
    prompt: "Implement the next item"
    conditions:
      - command: check-todos-complete
        args: { memoryKey: plan-todo }
        jump: Implement  # will stop jumping after 5 executions
```

## Model Aliases

Instead of hardcoding model IDs, use aliases that resolve via the `workflow_models` memory domain:

| Alias | Default |
| --- | --- |
| `smart` | `claude-opus-4-6` |
| `general` | `claude-sonnet-4-6` |
| `fast` | `claude-haiku-4-5` |

Override an alias by writing to the `workflow_models` memory domain:

```
memory_add domain=workflow_models key=smart value=claude-sonnet-4-6
```

## Modules

Modules control which skills appear in the system prompt's `<available_skills>` block.

- **Workflow-level** `modules`: active for all prompt steps
- **Step-level** `modules`: merged with workflow-level for that step only

```yaml
name: My Workflow
modules:
  - development        # Active for all steps
steps:
  - name: Test
    model: general
    prompt: Run all tests.
    modules:
      - testing        # Also active for this step
```

## Conditions

Conditions evaluate after a step completes. If a condition returns `"yes"`, the workflow jumps to the named step. If all return `"no"`, the workflow advances sequentially.

### Prompt Conditions

Use an LLM to evaluate:

```yaml
conditions:
  - prompt: |
      Check whether there are remaining issues.
    model: fast
    jump: Fix Issues
```

### Command Conditions

Use deterministic code — faster and more reliable:

```yaml
conditions:
  - command: check-todos-complete
    args:
      memoryKey: plan-todo
    jump: Implement
```

`prompt` and `command` are mutually exclusive in conditions, same as in steps.

### Available Commands

| Command | Type | Args | Description |
| --- | --- | --- | --- |
| `check-todos-complete` | condition | `memoryKey` or `todoFilepath` | Checks a todo file for unchecked `- [ ]` items. `memoryKey` reads the file path from workflow memory; `todoFilepath` uses a path directly. Mutually exclusive. |

## Prompt Resolution

Inline prompts use YAML block scalar syntax:

```yaml
prompt: |
  Multi-line prompt text
  goes here.
```

File references use `@` prefix, resolved relative to the working directory:

```yaml
prompt: @docs/prompts/review-checklist.md
```

## Memory Store

Each workflow run gets a shared memory domain (keyed by workflow ID). Steps can read/write to it using the memory tools, enabling data passing between steps.

The message template tells the agent about the domain:

```
A shared memory store has been created for this workflow under the domain "<id>".
Use the memory tools (memory_add, memory_get, memory_list) with this domain
to pass information between steps.
```

## Execution Model

- Each prompt step starts a **new session** (clean context window)
- Command steps execute inline — no session, no LLM call
- The user's original prompt is included in every prompt step's message
- When `approval: false`, the next step starts automatically
- When `approval: true`, the user must run `/workflow continue`
- Conditions are evaluated after each step completes (both types)

## Subcommands

| Command | Purpose |
| --- | --- |
| `/workflow continue` | Approve current step and advance |
| `/workflow status` | Show current step info |
| `/workflow abort` | Cancel the running workflow |

## Example

```yaml
name: Feature Implementation
steps:
  - name: Brainstorm
    model: smart
    prompt: |
      Brainstorm with the user to flesh out all the details.
      Store the design doc path to memory key "design-doc".
    skills:
      - brainstorming
    approval: true

  - name: Plan
    model: smart
    prompt: |
      Read the design doc from memory key "design-doc".
      Create a step-by-step implementation plan.
      Store "plan" and "plan-todo" keys to memory.
    skills:
      - writing-plans

  - name: Implement
    model: smart
    prompt: |
      Read the plan from memory key "plan".
      Execute the plan.
    skills:
      - executing-plans
    conditions:
      - command: check-todos-complete
        args:
          memoryKey: plan-todo
        jump: Implement
```
