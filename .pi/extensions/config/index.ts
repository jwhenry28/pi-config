import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { getCwd } from "../shared/cwd.js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readKey, writeKey } from "../memory/store.js";
import { getRegistry, findEntry, getAllNames } from "./registry.js";
import { applyConfigFile, unapplyConfigFile } from "./apply.js";
import { parseConfigFile } from "./schema.js";
import { completeNames } from "../shared/yaml-files.js";
import { CONFIG_STORE, CONFIGS_DIR } from "./constants.js";
import type { ConfigUI, ConfigModelRegistry } from "./types.js";

const YAML_EXT_RE = /\.ya?ml$/;

const SUBCOMMANDS: AutocompleteItem[] = [
  { value: "list", label: "list — List all config keys and values" },
  { value: "get", label: "get <name> — Show a config value" },
  { value: "set", label: "set <name> <value> — Set a config value" },
  { value: "apply", label: "apply <name> — Apply a config file" },
  { value: "unapply", label: "unapply <name> — Unapply a config file" },
  { value: "help", label: "help — Show help message" },
];

interface CommandContext {
  cwd: string;
  storeName: string;
  ui: ConfigUI;
  modelRegistry: ConfigModelRegistry;
  reload?: () => void;
}

// --- Entry point ---

export default function configExtension(pi: ExtensionAPI) {
  let cwd = "";

  pi.on("session_start", async (_event, ctx) => {
    cwd = getCwd(ctx);
  });

  pi.registerCommand("config", {
    description: "Manage configuration values",
    getArgumentCompletions: (prefix) => getAutocompletionsForConfig(prefix, cwd),
    handler: async (args, ctx) => handleConfig(args, { ...ctx, cwd: getCwd(ctx), storeName: CONFIG_STORE, reload: () => ctx.reload?.() }),
  });
}

// --- Command dispatch ---

function handleConfig(args: string, ctx: CommandContext): void {
  const { subcommand, rest } = parseSubcommand(args);

  if (!subcommand || subcommand === "help") {
    ctx.ui.notify(
      [
        "Usage: /config <subcommand> [args...]",
        "",
        "  list                 List all config keys and current values",
        "  get <name>           Show the value of a config key",
        "  set <name> <value>   Set a config value",
        "  apply <name>         Apply a config file from .pi-config/configs/",
        "  unapply <name>       Unapply a config file (remove its settings)",
        "  help                 Show this help message",
      ].join("\n"),
      "info",
    );
    return;
  }

  switch (subcommand) {
    case "list":
      return handleList(ctx);
    case "get":
      return handleGet(rest, ctx);
    case "set":
      return handleSet(rest, ctx);
    case "apply":
      return handleApply(rest, ctx);
    case "unapply":
      return handleUnapply(rest, ctx);
    default:
      ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use list, get, set, apply, unapply, or help.`, "warning");
  }
}

// --- Subcommand handlers ---

function handleList(ctx: CommandContext): void {
  const entries = getRegistry().map((entry) => ({
    name: entry.name,
    description: entry.description,
    default: entry.default,
    current: readKey(ctx.cwd, ctx.storeName, entry.name),
  }));
  ctx.ui.notify(formatListOutput(entries), "info");
}

function handleGet(rest: string, ctx: CommandContext): void {
  if (!rest) {
    ctx.ui.notify("Usage: /config get <name>", "warning");
    return;
  }
  const entry = findEntry(rest);
  if (!entry) {
    ctx.ui.notify(`Unknown config key: ${rest}. Use /config list to see available keys.`, "warning");
    return;
  }
  const value = readKey(ctx.cwd, ctx.storeName, rest);
  if (value) {
    ctx.ui.notify(`${rest} = ${value}`, "info");
  } else if (entry.default) {
    ctx.ui.notify(`${rest} = ${entry.default} (default)`, "info");
  } else {
    ctx.ui.notify(`${rest} is not set`, "info");
  }
}

function handleSet(rest: string, ctx: CommandContext): void {
  const setParts = rest.split(/\s+/);
  const name = setParts[0] ?? "";
  const value = setParts.slice(1).join(" ");
  if (!name || !value) {
    ctx.ui.notify("Usage: /config set <name> <value>", "warning");
    return;
  }
  const entry = findEntry(name);
  if (!entry) {
    ctx.ui.notify(`Unknown config key: ${name}. Use /config list to see available keys.`, "warning");
    return;
  }
  try {
    if (entry.validator) {
      entry.validator(value, ctx);
    }
    writeKey(ctx.cwd, ctx.storeName, name, value);
    ctx.ui.notify(formatSetSummary(name, value), "info");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.ui.notify(message, "error");
  }
}

function handleApply(rest: string, ctx: CommandContext): void {
  if (!rest) {
    ctx.ui.notify("Usage: /config apply <name>", "warning");
    return;
  }
  try {
    const content = readConfigYaml(ctx.cwd, rest);
    const configFile = parseConfigFile(content);
    const result = applyConfigFile(configFile, ctx);
    const lines = [`Applied config: ${configFile.name}`];
    if (result.updatedKeys.length > 0) {
      lines.push(`Updated ${result.updatedKeys.length} key(s): ${result.updatedKeys.join(", ")}`);
    }
    if (result.skills.length > 0) {
      lines.push(`Added ${result.skills.length} skill(s): ${result.skills.join(", ")}`);
    }
    if (result.workflows.length > 0) {
      lines.push(`Added ${result.workflows.length} workflow(s): ${result.workflows.join(", ")}`);
    }
    if (result.updatedKeys.length === 0 && result.skills.length === 0 && result.workflows.length === 0) {
      lines.push("No changes applied.");
    }
    if (result.warnings.length > 0) {
      lines.push(`Warnings (${result.warnings.length}):`);
      for (const w of result.warnings) lines.push(`- ${w}`);
    }
    ctx.ui.notify(lines.join("\n"), "info");
    if (result.needsReload && ctx.reload) {
      ctx.reload();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.ui.notify(message, "error");
  }
}

function handleUnapply(rest: string, ctx: CommandContext): void {
  if (!rest) {
    ctx.ui.notify("Usage: /config unapply <name>", "warning");
    return;
  }
  try {
    const content = readConfigYaml(ctx.cwd, rest);
    const configFile = parseConfigFile(content);
    const result = unapplyConfigFile(configFile, ctx);
    const lines = [`Unapplied config: ${configFile.name}`];
    if (result.updatedKeys.length > 0) {
      lines.push(`Removed ${result.updatedKeys.length} key(s): ${result.updatedKeys.join(", ")}`);
    }
    if (result.skills.length > 0) {
      lines.push(`Removed ${result.skills.length} skill(s): ${result.skills.join(", ")}`);
    }
    if (result.workflows.length > 0) {
      lines.push(`Removed ${result.workflows.length} workflow(s): ${result.workflows.join(", ")}`);
    }
    if (result.warnings.length > 0) {
      lines.push(`Warnings (${result.warnings.length}):`);
      for (const w of result.warnings) lines.push(`- ${w}`);
    }
    ctx.ui.notify(lines.join("\n"), "info");
    if (result.needsReload && ctx.reload) {
      ctx.reload();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.ui.notify(message, "error");
  }
}

// --- Autocompletions ---

function getAutocompletionsForConfig(
  prefix: string,
  cwd: string,
): AutocompleteItem[] | null {
  const hasTrailingSpace = prefix.endsWith(" ");
  const trimmed = prefix.trim();

  if (!trimmed) return SUBCOMMANDS;

  const parts = trimmed.split(/\s+/);
  const subcommand = parts[0] ?? "";

  if (parts.length === 1 && !hasTrailingSpace) {
    const matches = SUBCOMMANDS.filter((s) => s.value.startsWith(subcommand));
    return matches.length > 0 ? matches : null;
  }

  if (subcommand === "get" || subcommand === "set") {
    if (parts.length <= 2 && (parts.length === 1 || (parts.length === 2 && !hasTrailingSpace))) {
      const namePrefix = hasTrailingSpace ? "" : (parts[1] ?? "");
      const matches = completeNames(namePrefix, getAllNames());
      if (!matches) return null;
      return matches.map((item) => ({
        value: `${subcommand} ${item.value}`,
        label: item.label,
      }));
    }
    return null;
  }

  if (subcommand === "apply" || subcommand === "unapply") {
    const namePrefix = hasTrailingSpace ? "" : (parts[1] ?? "");
    const matches = completeNames(namePrefix, listConfigFiles(cwd));
    if (!matches) return null;
    return matches.map((item) => ({
      value: `${subcommand} ${item.value}`,
      label: item.label,
    }));
  }

  return null;
}

// --- Formatting utilities ---

export function parseSubcommand(args: string): { subcommand: string; rest: string } {
  const trimmed = args.trim();
  if (!trimmed) return { subcommand: "", rest: "" };
  const parts = trimmed.split(/\s+/);
  return { subcommand: parts[0] ?? "", rest: parts.slice(1).join(" ") };
}

export function formatSetSummary(name: string, value: string): string {
  return `Set ${name} = ${value}`;
}

export function formatListOutput(
  entries: Array<{ name: string; description: string; default?: string; current: string | null }>,
): string {
  return entries
    .map((e) => {
      const value = e.current ?? e.default ?? "not set";
      const defaultNote = e.default ? ` (default: ${e.default})` : "";
      const isOverridden = e.current && e.current !== e.default;
      const overrideNote = isOverridden ? " *" : "";
      return `${e.name.padEnd(12)} ${e.description.padEnd(40)} ${value}${overrideNote}${defaultNote}`;
    })
    .join("\n");
}

// --- File helpers ---

function listConfigFiles(cwd: string): string[] {
  const dir = join(cwd, CONFIGS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => YAML_EXT_RE.test(f))
    .map((f) => f.replace(YAML_EXT_RE, ""));
}

function readConfigYaml(cwd: string, name: string): string {
  const dir = join(cwd, CONFIGS_DIR);
  if (!existsSync(dir)) throw new Error(`Config directory not found: ${CONFIGS_DIR}`);
  const files = readdirSync(dir).filter((f) => YAML_EXT_RE.test(f));
  const match = files.find((f) => f.replace(YAML_EXT_RE, "") === name);
  if (!match) throw new Error(`Config file not found: ${name}`);
  return readFileSync(join(dir, match), "utf-8");
}
