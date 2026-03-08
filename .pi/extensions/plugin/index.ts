import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { getCwd } from "../shared/cwd.js";
import { loadAllSkills } from "../shared/skill-loader.js";
import type { ResolvedSkill } from "../shared/types.js";
import type { PluginExecutionContext } from "./constants.js";
import { discoverModules, type ModuleContents } from "./modules/registry.js";
import { loadState, saveState, computeActiveTools, computeExcludedSkillNames, type ModuleState } from "./modules/state.js";
import type { ModuleToolTagEvent } from "./modules/api.js";
import { dispatchRepoCommand, getRepoCompletions } from "./commands/repo.js";
import { dispatchSkillCommand, getSkillCompletions } from "./commands/skill.js";
import { dispatchWorkflowCommand, getWorkflowCompletions } from "./commands/workflow.js";
import { handleModuleCommand, getModuleNameCompletions, type ModuleManager } from "./commands/module.js";

// --- Constants ---

const SUBCOMMANDS: AutocompleteItem[] = [
  { value: "repo download ", label: "repo download — Clone a GitHub repo into ~/.pi/plugins/" },
  { value: "repo update ", label: "repo update — Pull latest for a plugin (or all)" },
  { value: "repo remove ", label: "repo remove — Remove a plugin repo and its wrappers" },
  { value: "skill add ", label: "skill add — Create a WRAPPER.md for a skill" },
  { value: "skill remove ", label: "skill remove — Remove a skill's WRAPPER.md" },
  { value: "skill tag ", label: "skill tag — Set the module for a skill" },
  { value: "workflow add ", label: "workflow add — Copy a workflow from a plugin repo" },
  { value: "workflow remove ", label: "workflow remove — Remove a local workflow" },
  { value: "module show ", label: "module show — Show a module (activate skills and tools)" },
  { value: "module hide ", label: "module hide — Hide a module (deactivate skills and tools)" },
  { value: "module list", label: "module list — Show all discovered modules" },
  { value: "help", label: "help — Show help message" },
];

const HELP_TEXT = [
  "Usage: /plugin <subcommand> [args...]",
  "",
  "  repo download <url> [alias]  Clone a GitHub repo into ~/.pi/plugins/",
  "  repo update [name]           Pull latest for a plugin (or all plugins)",
  "  repo remove <name>           Remove a plugin repo and its wrappers",
  "  skill add <path> [module]    Create a WRAPPER.md pointing to a skill",
  "  skill remove <name>          Remove a skill's WRAPPER.md",
  "  skill tag <name> <module>    Set the module for a skill",
  "  workflow add <name>          Copy a workflow from a plugin repo",
  "  workflow remove <name>       Remove a local workflow",
  "  module show <name>           Show a module (activate its skills and tools)",
  "  module hide <name>           Hide a module (deactivate its skills and tools)",
  "  module list [name]           Show all modules or details of one module",
  "  help                         Show this help message",
].join("\n");

// --- Utility ---

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- Extension ---

export default function pluginExtension(pi: ExtensionAPI) {
  // --- Module state ---

  let cwd = "";
  let allSkills: ResolvedSkill[] = [];
  let moduleMap: Map<string, ModuleContents> = new Map();
  let moduleState: ModuleState = { shown: [], granular: {} };
  let moduleInitialized = false;

  const toolModuleMap = new Map<string, string>();

  pi.events.on("module:tool-tag", (data: ModuleToolTagEvent) => {
    toolModuleMap.set(data.toolName, data.moduleName);
  });

  // --- Module management ---

  function refreshModules(): void {
    moduleMap = discoverModules(allSkills, toolModuleMap);
    moduleState = loadState(cwd);
    applyToolFiltering();
  }

  function ensureModulesInitialized(): void {
    if (moduleInitialized) return;
    refreshModules();
    moduleInitialized = true;
  }

  function applyToolFiltering(): void {
    const allToolNames = pi.getAllTools().map(t => t.name);
    const activeTools = computeActiveTools(allToolNames, moduleMap, moduleState);
    pi.setActiveTools(activeTools);
  }

  function commitModuleState(): void {
    saveState(cwd, moduleState);
    applyToolFiltering();
  }

  function showModule(name: string): boolean {
    if (!moduleMap.has(name)) return false;
    if (!moduleState.shown) moduleState.shown = [];
    if (moduleState.shown.includes(name)) return false;
    moduleState.shown.push(name);
    commitModuleState();
    return true;
  }

  function hideModule(name: string): boolean {
    if (!moduleMap.has(name)) return false;
    if (!moduleState.shown) moduleState.shown = [];
    const idx = moduleState.shown.indexOf(name);
    if (idx === -1) return false;
    moduleState.shown.splice(idx, 1);
    commitModuleState();
    return true;
  }

  function setModules(names: string[]): void {
    moduleState.shown = names.filter(name => moduleMap.has(name));
    commitModuleState();
  }

  function rebuildSkillsInPrompt(systemPrompt: string): string {
    const excluded = computeExcludedSkillNames(moduleMap, moduleState);
    const shownSkills = allSkills.filter(s => !excluded.has(s.name));

    const lines = ["<available_skills>"];
    for (const skill of shownSkills) {
      lines.push("  <skill>");
      lines.push(`    <name>${escapeXml(skill.name)}</name>`);
      lines.push(`    <description>${escapeXml(skill.description)}</description>`);
      lines.push(`    <location>${escapeXml(skill.filePath)}</location>`);
      lines.push("  </skill>");
    }
    lines.push("</available_skills>");
    const skillsBlock = lines.join("\n");

    const existingPattern = /<available_skills>[\s\S]*?<\/available_skills>/;
    if (existingPattern.test(systemPrompt)) {
      return systemPrompt.replace(existingPattern, skillsBlock);
    }
    return systemPrompt + "\n" + skillsBlock;
  }

  const moduleManager: ModuleManager = {
    ensureInitialized: ensureModulesInitialized,
    getModuleMap: () => moduleMap,
    getModuleState: () => moduleState,
    showModule,
    hideModule,
  };

  // --- Event hooks ---

  pi.on("session_start", async (_event, ctx) => {
    cwd = getCwd(ctx);
    allSkills = loadAllSkills(cwd);
    moduleInitialized = false;
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    ensureModulesInitialized();

    const currentPrompt = ctx.getSystemPrompt();
    const rebuiltPrompt = rebuildSkillsInPrompt(currentPrompt);

    if (rebuiltPrompt !== currentPrompt) {
      return { systemPrompt: rebuiltPrompt };
    }
  });

  // --- Programmatic event API ---

  pi.events.on("module:show", (data: { name: string }) => {
    ensureModulesInitialized();
    showModule(data.name);
  });

  pi.events.on("module:hide", (data: { name: string }) => {
    ensureModulesInitialized();
    hideModule(data.name);
  });

  pi.events.on("module:set", (data: { names: string[] }) => {
    ensureModulesInitialized();
    setModules(data.names);
  });

  pi.events.on("module:get-state", (data: { callback: (info: { shown: string[]; modules: Map<string, ModuleContents> }) => void }) => {
    ensureModulesInitialized();
    const shownModules = moduleState.shown ?? [];
    data.callback({ shown: [...shownModules], modules: moduleMap });
  });

  // --- Commands ---

  pi.registerCommand("plugin", {
    description: "Manage external skill repos, wrappers, collections, and modules",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      const trimmed = prefix.replace(/\t/g, "").trimStart();

      // module show|hide|list <name>
      const moduleMatch = trimmed.match(/^module\s+(show|hide|list)\s*(.*)/);
      if (moduleMatch) {
        const completions = getModuleNameCompletions(moduleMatch[1], moduleMatch[2], moduleMap);
        if (!completions) return null;
        return completions.map(c => ({ ...c, value: `module ${c.value}` }));
      }

      // repo <subcommand> <args>
      const repoMatch = trimmed.match(/^repo\s+(\S+)\s*(.*)/);
      if (repoMatch) {
        return getRepoCompletions(repoMatch[1], repoMatch[2]);
      }

      // skill <subcommand> <args>
      const skillMatch = trimmed.match(/^skill\s+(\S+)\s*(.*)/);
      if (skillMatch) {
        return getSkillCompletions(skillMatch[1], skillMatch[2], cwd);
      }

      // workflow <subcommand> <args>
      const workflowMatch = trimmed.match(/^workflow\s+(\S+)\s*(.*)/);
      if (workflowMatch) {
        return getWorkflowCompletions(workflowMatch[1], workflowMatch[2], cwd);
      }

      const filtered = SUBCOMMANDS.filter((item) => item.value.startsWith(trimmed));
      return filtered.length > 0 ? filtered : null;
    },
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/);
      const group = parts[0];

      if (!group || group === "help") {
        ctx.ui.notify(HELP_TEXT, "info");
        return;
      }

      const tex: PluginExecutionContext = { cwd: getCwd(ctx), ui: ctx.ui, reload: ctx.reload };

      switch (group) {
        case "repo":
          await dispatchRepoCommand(parts, tex);
          break;
        case "skill":
          await dispatchSkillCommand(parts, tex);
          break;
        case "workflow":
          await dispatchWorkflowCommand(parts, tex);
          break;
        case "module":
          await handleModuleCommand(parts.slice(1).join(" "), { cwd: getCwd(ctx), ui: ctx.ui }, moduleManager);
          break;
        default:
          ctx.ui.notify(`Unknown subcommand group: ${group}. Use repo, skill, module, or help.`, "warning");
      }
    },
  });
}
