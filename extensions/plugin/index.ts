import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { getCwd } from "../shared/cwd.js";
import type { PluginExecutionContext } from "./constants.js";
import { getPluginNameCompletions } from "./completions.js";
import { handleDownload, handleUpdate, handleRemove, handleEnable, handleDisable, handleList } from "./handlers.js";

let cachedCwd = "";

const SUBCOMMANDS: AutocompleteItem[] = [
  { value: "download ", label: "download — Clone a GitHub repo into ~/.pi/plugins/" },
  { value: "update ", label: "update — Pull latest for a plugin (or all)" },
  { value: "remove ", label: "remove — Remove a plugin repo" },
  { value: "enable ", label: "enable — Enable a plugin repo" },
  { value: "disable ", label: "disable — Disable a plugin repo" },
  { value: "list", label: "list — List all plugin repos and their status" },
  { value: "help", label: "help — Show help message" },
];

const VALID_COMMANDS = ["download", "update", "remove", "enable", "disable", "list"];

const HELP_TEXT = [
  "Usage: /plugin <subcommand> [args...]",
  "",
  "  download <url> [alias]  Clone a GitHub repo into ~/.pi/plugins/",
  "  update [name]           Pull latest for a plugin (or all plugins)",
  "  remove <name>           Remove a plugin repo",
  "  enable <name>           Enable a plugin (load its skills and workflows)",
  "  disable <name>          Disable a plugin (unload its skills and workflows)",
  "  list                    List all plugin repos and their status",
  "  help                    Show this help message",
].join("\n");

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
        const sub = match[1];
        if (sub === "remove" || sub === "update" || sub === "enable" || sub === "disable") {
          return getPluginNameCompletions(sub, match[2], cachedCwd);
        }
        return null;
      }

      const filtered = SUBCOMMANDS.filter((item) => item.value.startsWith(trimmed));
      return filtered.length > 0 ? filtered : null;
    },
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0];

      if (!subcommand || subcommand === "help") {
        ctx.ui.notify(HELP_TEXT, "info");
        return;
      }

      if (!VALID_COMMANDS.includes(subcommand)) {
        ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use /plugin help for usage.`, "warning");
        return;
      }

      const tex: PluginExecutionContext = { cwd: getCwd(ctx), ui: ctx.ui, reload: ctx.reload };
      await dispatchCommand(subcommand, parts, tex);
    },
  });
}

async function dispatchCommand(subcommand: string, parts: string[], tex: PluginExecutionContext): Promise<void> {
  switch (subcommand) {
    case "download": return handleDownload(parts, tex);
    case "update": return handleUpdate(parts, tex);
    case "remove": return handleRemove(parts, tex);
    case "enable": return handleEnable(parts, tex);
    case "disable": return handleDisable(parts, tex);
    case "list": return handleList(tex);
  }
}
