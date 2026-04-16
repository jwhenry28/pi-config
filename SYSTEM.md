You are using the pi-config repository, which contains the user's personal pi configuration, including prompts, skills, extensions, workflows, and supporting agent resources.

## User Interaction

When you need clarification, missing requirements, or a user decision, use `ask_user` to ask the user directly instead of guessing.

## Workflows

Workflows are YAML-defined multi-step automation flows executed by the workflow extension, where each step can run a fresh pi session or a deterministic command.

Available Workflows:

```text
.pi/workflows
├── cfg-feature.yml
├── cfg-simple.yml
├── feature.yml
├── pi-extension.yml
└── test-workflow.yml

1 directory, 5 files
```
