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
| `model` | Yes | — | Model ID or alias (see below) |
| `prompt` | Yes | — | Inline text or `@path` to a markdown file |
| `skills` | No | `[]` | Skill names to load (empty = no skills) |
| `approval` | No | `false` | Require `/workflow approve` before advancing |

## Model Aliases

Instead of hardcoding specific model IDs, you can use general aliases that map to different models:

| Alias | Default Model | Use Case |
| --- | --- | --- |
| `smart` | `claude-opus-4-6` | Complex reasoning, planning, architecture |
| `general` | `claude-sonnet-4-6` | Balanced performance and cost |
| `fast` | `claude-haiku-4-5` | Quick tasks, simple queries |

### Customizing Aliases

Users can override these mappings using the memory store:

```
/memory add workflow_models smart claude-opus-4-7
/memory add workflow_models general claude-sonnet-4-7
/memory add workflow_models fast claude-haiku-4-6
```

This allows workflows to be written with stable aliases while easily updating to newer models or switching providers.

### Specifying a Provider

If you have custom models defined in `~/.pi/agent/models.json` under a specific provider, you can use the `provider/model-id` format to explicitly select which provider to use. This is useful when multiple providers have models with the same ID, or when you want to use a custom provider without clobbering built-in provider definitions.

Example:

```
/memory add workflow_models smart custom/kimi-k2.5
```

Where `custom` is the provider name in your `models.json`:

```json
{
  "providers": {
    "custom": {
      "baseUrl": "https://api.moonshot.ai/v1",
      "api": "openai-completions",
      "apiKey": "MOONSHOT_API_KEY",
      "models": [{ "id": "kimi-k2.5" }]
    }
  }
}
```

The workflow extension will use `registry.find("custom", "kimi-k2.5")` to locate the correct model with its associated API key configuration.

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
    model: smart
    prompt: |
      Analyze the codebase and create a detailed implementation plan.
      Read all relevant files in full. Do not make any changes.
      Write the plan to docs/plans/.
    skills:
      - writing-plans
    approval: true

  - name: Implement
    model: general
    prompt: |
      Read the plan in docs/plans/ and implement it step by step.
      Run tests after each change.
    skills:
      - executing-plans

  - name: Review
    model: smart
    prompt: |
      Review all changes made in this session.
      Check for correctness, edge cases, and test coverage.
      Summarize findings.
    approval: true
```
