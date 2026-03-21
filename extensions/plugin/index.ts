import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { getCwd } from "../shared/cwd.js";
import type { PluginExecutionContext } from "./constants.js";
import { getPluginNameCompletions } from "./completions.js";
import { handleDownload, handleUpdate, handleRemove, handleEnable, handleDisable, handleList, handleCheckout } from "./handlers.js";

let cachedCwd = "";

interface Subcommand {
  autocompleteLabel: string;
  helpText: string;
  hasArgCompletions?: boolean;
  handler: (parts: string[], tex: PluginExecutionContext) => Promise<void>;
}

const SUBCOMMANDS: Record<string, Subcommand> = {
  download: {
    autocompleteLabel: "download — Clone a GitHub repo into ~/.pi/plugins/",
    helpText: "download <url> [alias]  Clone a GitHub repo into ~/.pi/plugins/",
    handler: handleDownload,
  },
  update: {
    autocompleteLabel: "update — Pull latest for a plugin (or all)",
    helpText: "update [name]           Pull latest for a plugin (or all plugins)",
    hasArgCompletions: true,
    handler: handleUpdate,
  },
  checkout: {
    autocompleteLabel: "checkout — Switch a plugin to a different branch",
    helpText: "checkout <name> <branch> Switch a plugin to a different git branch",
    hasArgCompletions: true,
    handler: handleCheckout,
  },
  remove: {
    autocompleteLabel: "remove — Remove a plugin repo",
    helpText: "remove <name>           Remove a plugin repo",
    hasArgCompletions: true,
    handler: handleRemove,
  },
  enable: {
    autocompleteLabel: "enable — Enable a plugin (load its skills and workflows)",
    helpText: "enable <name>           Enable a plugin (load its skills and workflows)",
    hasArgCompletions: true,
    handler: handleEnable,
  },
  disable: {
    autocompleteLabel: "disable — Disable a plugin (unload its skills and workflows)",
    helpText: "disable <name>          Disable a plugin (unload its skills and workflows)",
    hasArgCompletions: true,
    handler: handleDisable,
  },
  list: {
    autocompleteLabel: "list — List all plugin repos and their status",
    helpText: "list                    List all plugin repos and their status",
    handler: async (_parts, _tex) => handleList(_tex),
  },
};

function buildHelpText(): string {
  const lines = ["Usage: /plugin <subcommand> [args...]", ""];
  for (const sub of Object.values(SUBCOMMANDS)) {
    lines.push(`  ${sub.helpText}`);
  }
  lines.push("  help                    Show this help message");
  return lines.join("\n");
}

function buildAutocompleteItems(): AutocompleteItem[] {
  const items: AutocompleteItem[] = Object.entries(SUBCOMMANDS).map(([name, sub]) => ({
    value: sub.handler.length ? `${name} ` : name,
    label: sub.autocompleteLabel,
  }));
  items.push({ value: "help", label: "help — Show help message" });
  return items;
}

const autocompleteItems = buildAutocompleteItems();

export default function pluginExtension(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    cachedCwd = getCwd(ctx);
  });

  pi.registerCommand("plugin", {
    description: "Manage external plugin repos",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      const trimmed = prefix.replace(/\t/g, "").trimStart();

      const match = trimmed.match(/^(\S+)\s+(.*)/);
      if (match) {
        const sub = SUBCOMMANDS[match[1]];
        if (sub?.hasArgCompletions) {
          return getPluginNameCompletions(match[1], match[2], cachedCwd);
        }
        return null;
      }

      const filtered = autocompleteItems.filter((item) => item.value.startsWith(trimmed));
      return filtered.length > 0 ? filtered : null;
    },
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0];

      if (!subcommand || subcommand === "help") {
        ctx.ui.notify(buildHelpText(), "info");
        return;
      }

      const sub = SUBCOMMANDS[subcommand];
      if (!sub) {
        ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use /plugin help for usage.`, "warning");
        return;
      }

      const tex: PluginExecutionContext = { cwd: getCwd(ctx), ui: ctx.ui, reload: ctx.reload };
      await sub.handler(parts, tex);
    },
  });
}
