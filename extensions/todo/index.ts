import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { loadSkills } from "@mariozechner/pi-coding-agent";
import { getCwd } from "../shared/cwd.js";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { handleAdd } from "./add.js";
import { handleList } from "./list.js";
import { handleDesign, type Skills } from "./design.js";
import { handleComplete, getTodoCompletions } from "./complete.js";
import { registerTodoTool } from "./tool.js";
import { TODO_STORE, type TodoExecutionContext } from "./constants.js";

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
  let extensionCwd: string | null = null;

  pi.on("session_start", async (_event, ctx) => {
    extensionCwd = getCwd(ctx);
    const result = loadSkills({ cwd: extensionCwd });
    allSkills = result.skills;
  });

  pi.registerCommand("todo", {
    description: "Manage todo items: add, list, design, complete",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      const trimmed = prefix.trimStart();

      if (trimmed.includes(" ")) {
        if (!extensionCwd) return null;
        for (const sub of ["complete", "design"]) {
          const subPrefix = `${sub} `;
          if (trimmed.startsWith(subPrefix)) {
            const partial = trimmed.slice(subPrefix.length);
            return getTodoCompletions(extensionCwd, TODO_STORE, sub, partial);
          }
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

      const tex: TodoExecutionContext = { cwd: getCwd(ctx), storeName: TODO_STORE, ui: ctx.ui };

      switch (subcommand) {
        case "add":
          await handleAdd(parts, tex);
          break;
        case "list":
          await handleList(tex);
          break;
        case "design":
          await handleDesign(parts, tex, pi, allSkills);
          break;
        case "complete":
          await handleComplete(parts, tex);
          break;
        default:
          ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use add, list, design, or complete.`, "warning");
      }
    },
  });
}
