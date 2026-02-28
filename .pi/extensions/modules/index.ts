import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { loadSkills } from "@mariozechner/pi-coding-agent";
import type { Skill } from "@mariozechner/pi-coding-agent";
import { discoverModules, type ModuleContents } from "./registry.js";
import { loadState, saveState, computeActiveTools, computeExcludedSkillNames, type ModuleState } from "./state.js";

export default function modulesExtension(pi: ExtensionAPI) {
  // --- Shared state ---

  let cwd = "";
  let allSkills: Skill[] = [];
  let modules: Map<string, ModuleContents> = new Map();
  let state: ModuleState = { loaded: [], granular: {} };
  let initialized = false;

  // --- Helpers ---

  /**
   * Rediscover modules, reload state, and reapply tool filtering.
   * Called on initialization and after any state change.
   */
  function refreshModules(): void {
    modules = discoverModules(allSkills);
    state = loadState(cwd);
    applyToolFiltering();
  }

  /**
   * Ensure modules are discovered and state is loaded.
   */
  function ensureInitialized(): void {
    if (!initialized) {
      refreshModules();
      initialized = true;
    }
  }

  /**
   * Apply tool filtering based on current module state.
   */
  function applyToolFiltering(): void {
    const allToolNames = pi.getAllTools().map(t => t.name);
    const activeTools = computeActiveTools(allToolNames, modules, state);
    pi.setActiveTools(activeTools);
  }

  /**
   * Persist state and reapply tool filtering. Called after any state mutation.
   */
  function commitState(): void {
    saveState(cwd, state);
    applyToolFiltering();
  }

  /**
   * Load a module by name. Returns false if the module doesn't exist or is already loaded.
   */
  function loadModule(name: string): boolean {
    if (!modules.has(name)) return false;
    if (state.loaded.includes(name)) return false;
    state.loaded.push(name);
    commitState();
    return true;
  }

  /**
   * Unload a module by name. Returns false if the module doesn't exist or isn't loaded.
   */
  function unloadModule(name: string): boolean {
    if (!modules.has(name)) return false;
    const idx = state.loaded.indexOf(name);
    if (idx === -1) return false;
    state.loaded.splice(idx, 1);
    commitState();
    return true;
  }

  /**
   * Set the exact list of loaded modules. Invalid names are silently ignored.
   */
  function setModules(names: string[]): void {
    state.loaded = names.filter(name => modules.has(name));
    commitState();
  }

  /**
   * Remove <skill> blocks from the system prompt for skills in unloaded modules.
   * Returns the modified system prompt.
   */
  function filterSkillsFromPrompt(systemPrompt: string): string {
    const excluded = computeExcludedSkillNames(modules, state);
    if (excluded.size === 0) return systemPrompt;

    // Match individual <skill>...<name>skillName</name>...</skill> blocks within <available_skills>
    let filtered = systemPrompt;
    for (const skillName of excluded) {
      const escapedName = escapeRegExp(skillName);
      const pattern = new RegExp(
        `\\s*<skill>\\s*<name>${escapedName}<\\/name>[\\s\\S]*?<\\/skill>`,
        "g"
      );
      filtered = filtered.replace(pattern, "");
    }

    return filtered;
  }

  // --- Event hooks ---

  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
    const result = loadSkills({ cwd });
    allSkills = result.skills;
    initialized = false;
  });

  pi.on("before_agent_start", async (event) => {
    ensureInitialized();

    const filteredPrompt = filterSkillsFromPrompt(event.systemPrompt);

    if (filteredPrompt !== event.systemPrompt) {
      return { systemPrompt: filteredPrompt };
    }
  });

  // --- Slash command ---

  pi.registerCommand("module", {
    description: "Manage modules: load, unload, list, status",
    getArgumentCompletions: (prefix) => {
      const parts = prefix.split(/\s+/);

      if (parts.length <= 1) {
        const subcommands = ["load", "unload", "list", "status", "help"];
        const filtered = subcommands.filter(s => s.startsWith(parts[0] || ""));
        return filtered.length > 0 ? filtered.map(s => ({ value: s, label: s })) : null;
      }

      const subcommand = parts[0];
      const modulePrefix = parts[1] || "";

      const needsModuleCompletion = subcommand === "load" || subcommand === "unload" || subcommand === "list";
      if (!needsModuleCompletion) return null;

      const moduleNames = Array.from(modules.keys());
      const filtered = moduleNames.filter(n => n.startsWith(modulePrefix));
      return filtered.length > 0 ? filtered.map(n => ({ value: `${subcommand} ${n}`, label: n })) : null;
    },
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0];

      if (!subcommand || subcommand === "help") {
        ctx.ui.notify(
          [
            "Usage: /module <subcommand> [args...]",
            "",
            "  load <name>      Load a module (activate its skills and tools)",
            "  unload <name>    Unload a module (deactivate its skills and tools)",
            "  list             Show all discovered modules",
            "  list <name>      Show skills and tools in a specific module",
            "  status           Show currently loaded modules",
            "  help             Show this help message",
          ].join("\n"),
          "info",
        );
        return;
      }

      ensureInitialized();

      switch (subcommand) {
        case "load": {
          const moduleName = parts[1];
          if (!moduleName) {
            ctx.ui.notify("Usage: /module load <name>", "warning");
            return;
          }
          if (!modules.has(moduleName)) {
            ctx.ui.notify(`Module "${moduleName}" not found`, "error");
            return;
          }
          if (!loadModule(moduleName)) {
            ctx.ui.notify(`Module "${moduleName}" is already loaded`, "warning");
            return;
          }
          const contents = modules.get(moduleName)!;
          ctx.ui.notify(`✓ Loaded module "${moduleName}" (${contents.skills.length} skill(s), ${contents.tools.length} tool(s))`, "info");
          break;
        }

        case "unload": {
          const moduleName = parts[1];
          if (!moduleName) {
            ctx.ui.notify("Usage: /module unload <name>", "warning");
            return;
          }
          if (!modules.has(moduleName)) {
            ctx.ui.notify(`Module "${moduleName}" not found`, "error");
            return;
          }
          if (!unloadModule(moduleName)) {
            ctx.ui.notify(`Module "${moduleName}" is not loaded`, "warning");
            return;
          }
          const contents = modules.get(moduleName)!;
          ctx.ui.notify(`✓ Unloaded module "${moduleName}" (${contents.skills.length} skill(s), ${contents.tools.length} tool(s))`, "info");
          break;
        }

        case "list": {
          const moduleName = parts[1];
          if (moduleName) {
            const contents = modules.get(moduleName);
            if (!contents) {
              ctx.ui.notify(`Module "${moduleName}" not found`, "error");
              return;
            }
            const lines = [`Module "${moduleName}":`];
            lines.push("  Skills:");
            if (contents.skills.length === 0) {
              lines.push("    (none)");
            } else {
              for (const skill of contents.skills) {
                lines.push(`    ${skill.name}`);
              }
            }
            lines.push("  Tools:");
            if (contents.tools.length === 0) {
              lines.push("    (none)");
            } else {
              for (const tool of contents.tools) {
                lines.push(`    ${tool}`);
              }
            }
            ctx.ui.notify(lines.join("\n"), "info");
          } else {
            const names = Array.from(modules.keys()).sort();
            if (names.length === 0) {
              ctx.ui.notify("No modules found. Tag skills with `module: <name>` in their SKILL.md frontmatter.", "info");
              return;
            }
            const lines = ["Available modules:"];
            for (const name of names) {
              const isLoaded = state.loaded.includes(name);
              lines.push(`  ${name}${isLoaded ? " (loaded)" : ""}`);
            }
            ctx.ui.notify(lines.join("\n"), "info");
          }
          break;
        }

        case "status": {
          if (state.loaded.length === 0) {
            ctx.ui.notify("No modules loaded", "info");
            return;
          }
          const lines = ["Loaded modules:"];
          for (const name of state.loaded) {
            lines.push(`  ${name}`);
          }
          ctx.ui.notify(lines.join("\n"), "info");
          break;
        }

        default:
          ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use load, unload, list, status, or help.`, "warning");
      }
    },
  });

  // --- Programmatic event API ---

  pi.events.on("module:load", (data: { name: string }) => {
    ensureInitialized();
    loadModule(data.name);
  });

  pi.events.on("module:unload", (data: { name: string }) => {
    ensureInitialized();
    unloadModule(data.name);
  });

  pi.events.on("module:set", (data: { names: string[] }) => {
    ensureInitialized();
    setModules(data.names);
  });

  pi.events.on("module:get-state", (data: { callback: (info: { loaded: string[]; modules: Map<string, ModuleContents> }) => void }) => {
    ensureInitialized();
    data.callback({ loaded: [...state.loaded], modules });
  });
}

// --- Utility ---

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
