---
name: moving-skills
description: Use when moving, reorganizing, or relocating pi skills between local .pi/skills and plugin repo skill libraries
---

# Moving Skills

## Two Ways Skills Are Organized

### 1. Main skills (local)

Live directly in `.pi/skills/<skill-name>/` as regular directories. These are project-specific or general-purpose skills.

### 2. Plugin repo skills (symlinked)

Live in a plugin repo's `skill-library/` and are symlinked from `.pi/skills/`.

**Important:** `.pi` is a symlink to `~/ChariotEngineering/worktrees/pi-config/.pi`. The plugin repos live as siblings of `pi-config`, so the real base path is `~/ChariotEngineering/worktrees/pi-config/`. Symlink targets use `../../<repo>` which resolves relative to the real `.pi/skills/` directory.

**Symlink pattern:**
```
.pi/skills/<skill-name> -> ../../<repo>/skill-library/<category>/<skill-name>
```

**Known repos and examples:**

| Repo | Real path | Example category/skill |
| --- | --- | --- |
| `praetorian-engineering` | `~/ChariotEngineering/worktrees/pi-config/praetorian-engineering` | `development/frontend/querybuilder-expert` |
| `praetorian-cloud` | `~/ChariotEngineering/worktrees/pi-config/praetorian-cloud` | `aurelian/writing-aurelian-integration-tests` |

## Moving a Local Skill to a Plugin Repo

1. Choose the repo and category path
2. Determine the real repo path (e.g. check existing symlinks with `ls -la .pi/skills/`)
3. Move the skill directory:
   ```bash
   mv .pi/skills/<skill-name> ~/ChariotEngineering/worktrees/pi-config/<repo>/skill-library/<category>/<skill-name>
   ```
4. Create the symlink:
   ```bash
   ln -s ../../<repo>/skill-library/<category>/<skill-name> .pi/skills/<skill-name>
   ```
5. Verify the symlink resolves: `ls .pi/skills/<skill-name>/`
6. Commit in both repos

## Moving a Plugin Repo Skill to Local

1. Remove the symlink and copy the skill:
   ```bash
   rm .pi/skills/<skill-name>
   cp -r ~/ChariotEngineering/worktrees/pi-config/<repo>/skill-library/<category>/<skill-name> .pi/skills/<skill-name>
   ```
2. Optionally remove from the plugin repo
