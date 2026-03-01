import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { moduleTag } from "../modules/api.js";
import { formatTodoList } from "./list.js";

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
        const result = formatTodoList(ctx.cwd);
        return {
          content: [
            { type: "text" as const, text: result ?? "No open todos." },
          ],
        };
      },
    }),
  );
}
