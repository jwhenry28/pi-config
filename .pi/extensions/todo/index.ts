import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { loadSkills } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { handleAdd } from "./add.js";
import { handleList } from "./list.js";
import { handleDesign, type Skills } from "./design.js";
import { handleComplete } from "./complete.js";
import { registerTodoTool } from "./tool.js";

const SUBCOMMANDS: AutocompleteItem[] = [
  { value: "add", label: "add — Add a new todo item" },
  { value: "list", label: "list — List all open todos" },
  { value: "design", label: "design — Generate a design for a todo" },
  { value: "complete", label: "complete — Complete a todo item" },
  { value: "help", label: "help — Show help message" },
];

export default function todoExtension(pi: ExtensionAPI) {
  registerTodoTool(pi);

  let allSkills: Skills = [];

  pi.on("session_start", async (_event, ctx) => {
    const result = loadSkills({ cwd: ctx.cwd });
    allSkills = result.skills;
  });

  pi.registerCommand("todo", {
    description: "Manage todo items: add, list, design, complete",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      const trimmed = prefix.trimStart();
      // Only complete the first word (subcommand), not subsequent arguments
      if (trimmed.includes(" ")) return null;
      const filtered = SUBCOMMANDS.filter((item) => item.value.startsWith(trimmed));
      return filtered.length > 0 ? filtered : null;
    },
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0];

      if (!subcommand || subcommand === "help") {
        ctx.ui.notify(
          [
            "Usage: /todo <subcommand> [args...]",
            "",
            "  add <name> <description>   Add a new todo item",
            "  list                       List all open todos",
            "  design <name>              Generate a design for a todo via brainstorming",
            "  complete <name>             Complete a todo item",
            "  help                       Show this help message",
            "",
            "Names must match [a-zA-Z0-9_-]+.",
          ].join("\n"),
          "info",
        );
        return;
      }

      switch (subcommand) {
        case "add":
          await handleAdd(parts, ctx);
          break;
        case "list":
          await handleList(ctx);
          break;
        case "design":
          await handleDesign(parts, ctx, pi, allSkills);
          break;
        case "complete":
          await handleComplete(parts, ctx);
          break;
        default:
          ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use add, list, design, or complete.`, "warning");
      }
    },
  });
}
