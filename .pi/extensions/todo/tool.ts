import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { getCwd } from "../shared/cwd.js";
import { moduleTag } from "../plugin/modules/api.js";
import { formatTodoList } from "./list.js";

/**
 * Core logic for the todo_list tool. Exported for testability.
 */
export function executeTodoList(cwd: string, storeName?: string): { content: Array<{ type: "text"; text: string }> } {
  const result = formatTodoList(cwd, storeName);
  return { content: [{ type: "text" as const, text: result ?? "No open todos." }] };
}

export function registerTodoTool(pi: ExtensionAPI) {
  pi.registerTool(
    moduleTag(pi, "agent-todo", {
      name: "todo_list",
      label: "Todo List",
      description:
        "List all open todo items for the project. Returns each todo's name, description, and whether it has a design.",
      parameters: Type.Object({}),
      async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
        if (signal?.aborted)
          return { content: [{ type: "text" as const, text: "Cancelled" }] };
        return executeTodoList(getCwd(ctx));
      },
    }),
  );
}
