import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { loadSkills } from "@mariozechner/pi-coding-agent";
import type { Skill } from "@mariozechner/pi-coding-agent";
import { discoverModules, type ModuleContents } from "./registry.js";
import { formatModulesBlock } from "./display.js";
import { loadState, saveState, computeActiveTools, computeExcludedSkillNames, type ModuleState } from "./state.js";
import type { ModuleToolTagEvent } from "./api.js";

export default function modulesExtension(pi: ExtensionAPI) {
  // --- Shared state ---

  let cwd = "";
  let allSkills: Skill[] = [];
  let modules: Map<string, ModuleContents> = new Map();
  let state: ModuleState = { shown: [], granular: {} };
  let initialized = false;

  /**
   * Tool-to-module associations collected via the shared event bus.
   * Other extensions emit "module:tool-tag" events (via moduleTag() from api.ts)
   * which are captured here. This works across extension boundaries because
   * pi.events is a shared event bus, unlike module-level state which is
   * isolated per extension due to jiti's moduleCache: false.
   */
  const toolModuleMap = new Map<string, string>();

  // Listen for tool-module tagging events from other extensions.
  // These fire synchronously during extension loading (inside pi.registerTool(moduleTag(...))),
  // so by the time ensureInitialized() runs, all tags are already collected.
  pi.events.on("module:tool-tag", (data: ModuleToolTagEvent) => {
    toolModuleMap.set(data.toolName, data.moduleName);
  });

  // --- Helpers ---

  /**
   * Rediscover modules, reload state, and reapply tool filtering.
   * Called on initialization and after any state change.
   */
  function refreshModules(): void {
    modules = discoverModules(allSkills, toolModuleMap);
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
   * Show a module by name. Returns false if the module doesn't exist or is already shown.
   */
  function showModule(name: string): boolean {
    if (!modules.has(name)) return false;
    if (!state.shown) state.shown = [];
    if (state.shown.includes(name)) return false;
    state.shown.push(name);
    commitState();
    return true;
  }

  /**
   * Hide a module by name. Returns false if the module doesn't exist or isn't shown.
   */
  function hideModule(name: string): boolean {
    if (!modules.has(name)) return false;
    if (!state.shown) state.shown = [];
    const idx = state.shown.indexOf(name);
    if (idx === -1) return false;
    state.shown.splice(idx, 1);
    commitState();
    return true;
  }

  /**
   * Set the exact list of shown modules. Invalid names are silently ignored.
   */
  function setModules(names: string[]): void {
    state.shown = names.filter(name => modules.has(name));
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
    description: "Manage modules: show, hide, list",
    getArgumentCompletions: (prefix) => {
      const parts = prefix.split(/\s+/);

      if (parts.length <= 1) {
        const subcommands = ["show", "hide", "list", "help"];
        const filtered = subcommands.filter(s => s.startsWith(parts[0] || ""));
        return filtered.length > 0 ? filtered.map(s => ({ value: s, label: s })) : null;
      }

      const subcommand = parts[0];
      const modulePrefix = parts[1] || "";

      const needsModuleCompletion = subcommand === "show" || subcommand === "hide" || subcommand === "list";
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
            "  show <name>      Show a module (activate its skills and tools)",
            "  hide <name>      Hide a module (deactivate its skills and tools)",
            "  list             Show all discovered modules (and which are shown)",
            "  list <name>      Show skills and tools in a specific module",
            "  help             Show this help message",
          ].join("\n"),
          "info",
        );
        return;
      }

      ensureInitialized();

      switch (subcommand) {
        case "show": {
          const moduleName = parts[1];
          if (!moduleName) {
            ctx.ui.notify("Usage: /module show <name>", "warning");
            return;
          }
          if (!modules.has(moduleName)) {
            ctx.ui.notify(`Module "${moduleName}" not found`, "error");
            return;
          }
          if (!showModule(moduleName)) {
            ctx.ui.notify(`Module "${moduleName}" is already shown`, "warning");
            return;
          }
          const contents = modules.get(moduleName)!;
          ctx.ui.notify(`✓ Shown module "${moduleName}" (${contents.skills.length} skill(s), ${contents.tools.length} tool(s))`, "info");
          break;
        }

        case "hide": {
          const moduleName = parts[1];
          if (!moduleName) {
            ctx.ui.notify("Usage: /module hide <name>", "warning");
            return;
          }
          if (!modules.has(moduleName)) {
            ctx.ui.notify(`Module "${moduleName}" not found`, "error");
            return;
          }
          if (!hideModule(moduleName)) {
            ctx.ui.notify(`Module "${moduleName}" is not shown`, "warning");
            return;
          }
          const contents = modules.get(moduleName)!;
          ctx.ui.notify(`✓ Hidden module "${moduleName}" (${contents.skills.length} skill(s), ${contents.tools.length} tool(s))`, "info");
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
            const shownModules = state.shown ?? [];
            const text = formatModulesBlock(
              names.map((name) => ({ name, shown: shownModules.includes(name) })),
              {
                formatHeader: (text) => ctx.ui.theme.fg("mdHeading", text),
                formatShownLine: (name) => `${ctx.ui.theme.fg("success", "*")} ${ctx.ui.theme.fg("dim", name)}`,
                formatHiddenLine: (name) => ctx.ui.theme.fg("dim", `- ${name}`),
              },
            );
            ctx.ui.notify(text, "info");
          }
          break;
        }

        default:
          ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use show, hide, list, or help.`, "warning");
      }
    },
  });

  // --- Programmatic event API ---

  pi.events.on("module:show", (data: { name: string }) => {
    ensureInitialized();
    showModule(data.name);
  });

  pi.events.on("module:hide", (data: { name: string }) => {
    ensureInitialized();
    hideModule(data.name);
  });

  pi.events.on("module:set", (data: { names: string[] }) => {
    ensureInitialized();
    setModules(data.names);
  });

  pi.events.on("module:get-state", (data: { callback: (info: { shown: string[]; modules: Map<string, ModuleContents> }) => void }) => {
    ensureInitialized();
    const shownModules = state.shown ?? [];
    data.callback({ shown: [...shownModules], modules });
  });
}

// --- Utility ---

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
