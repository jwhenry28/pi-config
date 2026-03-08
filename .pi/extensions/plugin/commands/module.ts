import type { AutocompleteItem } from "@mariozechner/pi-tui";
import type { ModuleContents } from "../modules/registry.js";
import type { ModuleState } from "../modules/state.js";
import { formatModulesBlock } from "../modules/display.js";
import type { ModuleCommandContext } from "../constants.js";

/** Read-only access to module state, provided by the plugin extension. */
export interface ModuleManager {
  ensureInitialized(): void;
  getModuleMap(): ReadonlyMap<string, ModuleContents>;
  getModuleState(): Readonly<ModuleState>;
  showModule(name: string): boolean;
  hideModule(name: string): boolean;
}

// --- Command handler ---

export async function handleModuleCommand(args: string, ctx: ModuleCommandContext, manager: ModuleManager): Promise<void> {
  const parts = args.trim().split(/\s+/);
  const action = parts[0];

  if (!action || action === "help") {
    showModuleHelp(ctx);
    return;
  }

  manager.ensureInitialized();
  const moduleMap = manager.getModuleMap();

  switch (action) {
    case "show":
      handleShow(parts[1], moduleMap, manager, ctx);
      break;
    case "hide":
      handleHide(parts[1], moduleMap, manager, ctx);
      break;
    case "list":
      handleList(parts[1], moduleMap, manager, ctx);
      break;
    default:
      ctx.ui.notify(`Unknown module subcommand: ${action}. Use show, hide, list, or help.`, "warning");
  }
}

// --- Autocomplete ---

export function getModuleNameCompletions(
  subcommand: string,
  modulePrefix: string,
  moduleMap: ReadonlyMap<string, ModuleContents>,
): AutocompleteItem[] | null {
  const needsCompletion = subcommand === "show" || subcommand === "hide" || subcommand === "list";
  if (!needsCompletion) return null;

  const filtered = Array.from(moduleMap.keys()).filter(n => n.startsWith(modulePrefix));
  return filtered.length > 0 ? filtered.map(n => ({ value: `${subcommand} ${n}`, label: n })) : null;
}

// --- Subcommand handlers ---

function showModuleHelp(ctx: ModuleCommandContext): void {
  ctx.ui.notify(
    [
      "Usage: /plugin module <subcommand> [args...]",
      "",
      "  show <name>      Show a module (activate its skills and tools)",
      "  hide <name>      Hide a module (deactivate its skills and tools)",
      "  list             Show all discovered modules (and which are shown)",
      "  list <name>      Show skills and tools in a specific module",
      "  help             Show this help message",
    ].join("\n"),
    "info",
  );
}

function handleShow(
  moduleName: string | undefined,
  moduleMap: ReadonlyMap<string, ModuleContents>,
  manager: ModuleManager,
  ctx: ModuleCommandContext,
): void {
  if (!moduleName) {
    ctx.ui.notify("Usage: /plugin module show <name>", "warning");
    return;
  }
  if (!moduleMap.has(moduleName)) {
    ctx.ui.notify(`Module "${moduleName}" not found`, "error");
    return;
  }
  if (!manager.showModule(moduleName)) {
    ctx.ui.notify(`Module "${moduleName}" is already shown`, "warning");
    return;
  }
  const contents = moduleMap.get(moduleName)!;
  ctx.ui.notify(`✓ Shown module "${moduleName}" (${contents.skills.length} skill(s), ${contents.tools.length} tool(s))`, "info");
}

function handleHide(
  moduleName: string | undefined,
  moduleMap: ReadonlyMap<string, ModuleContents>,
  manager: ModuleManager,
  ctx: ModuleCommandContext,
): void {
  if (!moduleName) {
    ctx.ui.notify("Usage: /plugin module hide <name>", "warning");
    return;
  }
  if (!moduleMap.has(moduleName)) {
    ctx.ui.notify(`Module "${moduleName}" not found`, "error");
    return;
  }
  if (!manager.hideModule(moduleName)) {
    ctx.ui.notify(`Module "${moduleName}" is not shown`, "warning");
    return;
  }
  const contents = moduleMap.get(moduleName)!;
  ctx.ui.notify(`✓ Hidden module "${moduleName}" (${contents.skills.length} skill(s), ${contents.tools.length} tool(s))`, "info");
}

function handleList(
  moduleName: string | undefined,
  moduleMap: ReadonlyMap<string, ModuleContents>,
  manager: ModuleManager,
  ctx: ModuleCommandContext,
): void {
  if (moduleName) {
    handleListDetail(moduleName, moduleMap, ctx);
  } else {
    handleListAll(moduleMap, manager, ctx);
  }
}

function handleListDetail(
  moduleName: string,
  moduleMap: ReadonlyMap<string, ModuleContents>,
  ctx: ModuleCommandContext,
): void {
  const contents = moduleMap.get(moduleName);
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
}

function handleListAll(
  moduleMap: ReadonlyMap<string, ModuleContents>,
  manager: ModuleManager,
  ctx: ModuleCommandContext,
): void {
  const names = Array.from(moduleMap.keys()).sort();
  if (names.length === 0) {
    ctx.ui.notify("No modules found. Tag skills with `module: <name>` in their SKILL.md frontmatter.", "info");
    return;
  }

  const shownModules = manager.getModuleState().shown ?? [];
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
