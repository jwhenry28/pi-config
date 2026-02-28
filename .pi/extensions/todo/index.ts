import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { loadSkills } from "@mariozechner/pi-coding-agent";
import { handleAdd } from "./add.js";
import { handleList } from "./list.js";
import { handleDesign, type Skills } from "./design.js";
import { handleRemove } from "./remove.js";

export default function todoExtension(pi: ExtensionAPI) {
  let allSkills: Skills = [];

  pi.on("session_start", async (_event, ctx) => {
    const result = loadSkills({ cwd: ctx.cwd });
    allSkills = result.skills;
  });

  pi.registerCommand("todo", {
    description: "Manage todo items: add, list, design, remove",
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
            "  remove <name>              Remove a todo item",
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
        case "remove":
          await handleRemove(parts, ctx);
          break;
        default:
          ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use add, list, design, or remove.`, "warning");
      }
    },
  });
}
