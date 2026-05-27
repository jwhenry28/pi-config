# pi workstation config

This repository is my personal collection of [pi](https://github.com/earendil-works/pi/tree/main/packages/coding-agent) extensions, skills, workflows, prompts, and workstation artifacts.

It is not a polished product package so much as a working lab: the place where I build the automation I actually use while coding with pi. Some parts are intentionally personal, but several extensions are general enough to be useful examples for anyone building richer agent workflows on top of pi.

## Highlights

### [`extensions/workflow/`](extensions/workflow/)

A YAML-driven workflow runner for multi-step agent processes.

Workflows live in `.pi/workflows` and can mix prompt steps, command steps, approval gates, model/thinking overrides, skills, modules, and conditional jumps. For example, [`workflows/feature.yml`](workflows/feature.yml) runs a feature through brainstorming, planning, implementation, and loops implementation while incomplete todos remain.

Notable features:

- `/workflow <name>`, `/workflow status`, `/workflow continue`, and `/workflow abort`
- Prompt references such as `@development/plan.md`
- Per-step model aliases (`smart`, `general`, `fast`) and thinking levels
- Per-step skill and module activation
- Human approval checkpoints
- Conditional branching via built-in command predicates or model-evaluated conditions
- Workflow pause tool for human clarification/blocker resolution
- Diagnostics written under `.pi-config/workflow-diagnostics` with token and cost totals

### [`extensions/memory/`](extensions/memory/)

A small project-local memory store system shared by other extensions and exposed to the agent.

Memory stores are JSON files under `.pi-config/memory`. Values are base64 encoded internally, and the API supports named stores, arbitrary keys, metadata timestamps, and reserved stores for extension-owned state.

Notable features:

- `/memory create|get|set|list|delete|purge|stats`
- Agent tools: `memory_create`, `memory_add`, `memory_get`, `memory_list`, `memory_delete`
- Reusable helpers (`readKey`, `writeKey`, `ensureStore`) used by workflow, todo, and config extensions

### [`extensions/modules/`](extensions/modules/)

A module system for selectively exposing skills and tools to the agent.

Skills can declare a module in frontmatter, and tools can be tagged with `moduleTag(...)`. The modules extension discovers those relationships, persists the visible module set, filters inactive skills out of the system prompt, and restricts active tools accordingly.

Notable features:

- `/module show <name>`, `/module hide <name>`, `/module list`
- Skill filtering at prompt-injection time
- Tool filtering through `pi.setActiveTools(...)`
- Cross-extension tool tagging via pi's event bus, including a replay buffer so extension load order does not matter

### [`extensions/todo/`](extensions/todo/)

A lightweight todo manager for coding sessions, built on top of the memory store.

Todos are useful both as human-visible task lists and as workflow control state. The workflow runner can loop based on incomplete todos, while the todo extension can generate design documents for individual items.

Notable features:

- `/todo add <name> <description>`
- `/todo list`
- `/todo design <name>` to create `todos/<name>.md` and launch a brainstorming prompt
- `/todo complete <name>`
- Completion support for todo names
- Agent tool support for adding/listing todos

### [`extensions/config/`](extensions/config/)

A small configuration layer for values that should be easy to switch per-project or per-workstation.

Currently this is used for model aliases consumed by workflows, so workflow files can say `smart`, `general`, or `fast` instead of hard-coding a provider/model everywhere.

Notable features:

- `/config list|get|set|apply|unapply`
- Validated model alias settings
- YAML config files under `.pi/configs`
- Shared storage via the memory extension

## Other contents

- [`skills/`](skills/) — personal coding, design, testing, and pi-development skills
- [`workflows/`](workflows/) — workflow definitions for common development loops
- [`prompts/`](prompts/) — reusable prompt files referenced by workflows
- [`configs/`](configs/) — model/provider config snippets
- [`extensions/`](extensions/) — additional tools for web access, timers, plugin loading, headers, Q&A helpers, and more
- [`archive/`](archive/) — older experiments and notes

## Development

This repo is TypeScript ESM and uses Vitest for tests.

```bash
npm install
npm test
```

The repository is intended to be used as a pi configuration/workstation repo rather than as a published npm package.
