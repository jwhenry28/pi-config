---
name: writing-workflows
description: Writing workflow YAML files for the /workflow extension - covers schema, step configuration, prompt references, and execution model
module: pi-development
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
steps:
  - name: Step 1
    model: claude-opus-4-6
    prompt: |
      Analyze the codebase and create a detailed plan.
    skills:
      - brainstorming
    approval: true

  - name: Step 2
    model: claude-sonnet-4-5
    prompt: @prompts/implement.md
```

## Step Properties

| Field | Required | Default | Description |
| --- | --- | --- | --- |
| `name` | Yes | — | Display name shown in the TUI status bar |
| `model` | Yes | — | Model ID (must match an available model) |
| `prompt` | Yes | — | Inline text or `@path` to a markdown file |
| `skills` | No | `[]` | Skill names to load (empty = no skills) |
| `approval` | No | `false` | Require `/workflow approve` before advancing |

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

## Message Template

Each step sends this as the user message:

```
You are running one step in the <workflow name> workflow. The top-level goal of this workflow is:
<user prompt from /workflow command>

You are currently on step <step name>. For this step, you must:
<resolved step prompt>
```

## Execution Model

- Steps run strictly in order
- Each step starts a **new session** (clean context window)
- The top-level prompt from `/workflow` is included in every step
- When `approval: false`, the next step starts automatically after the agent finishes
- When `approval: true`, the user must run `/workflow approve` to continue

## Subcommands

| Command | Purpose |
| --- | --- |
| `/workflow approve` | Approve current step and advance |
| `/workflow status` | Show current step info |
| `/workflow abort` | Cancel the running workflow |

## Example

```yaml
name: Feature Implementation
steps:
  - name: Plan
    model: claude-opus-4-6
    prompt: |
      Analyze the codebase and create a detailed implementation plan.
      Read all relevant files in full. Do not make any changes.
      Write the plan to docs/plans/.
    skills:
      - writing-plans
    approval: true

  - name: Implement
    model: claude-sonnet-4-5
    prompt: |
      Read the plan in docs/plans/ and implement it step by step.
      Run tests after each change.
    skills:
      - executing-plans

  - name: Review
    model: claude-opus-4-6
    prompt: |
      Review all changes made in this session.
      Check for correctness, edge cases, and test coverage.
      Summarize findings.
    approval: true
```
