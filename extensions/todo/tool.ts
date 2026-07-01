import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { getCwd } from "../shared/cwd.js";
import { moduleTag } from "../modules/api.js";
import { handleAdd } from "./add.js";
import { handleComplete } from "./complete.js";
import { handleDesign, type Skills } from "./design.js";
import { formatTodoList } from "./list.js";
import { TODO_STORE, type TodoUI } from "./constants.js";

const TODO_TOOL_USAGE_NOTICE =
  "Do not use this tool for task-related work or to manage your current task checklist. " +
  "Todo tools are only for tracking long-term, human selected initiatives that should be done later. " +
  "They are a convenience for a human operator who explicitly asks an agent to create or update todos from a conversation instead of manually making them.";

type TodoToolResult = { content: Array<{ type: "text"; text: string }>; details: undefined };

function asToolResult(text: string): TodoToolResult {
  return { content: [{ type: "text", text }], details: undefined };
}

function collectNotifications(confirm: TodoUI["confirm"] = async () => true): {
  ui: TodoUI;
  getText: () => string;
} {
  const notifications: Array<{ msg: string; level: string }> = [];
  return {
    ui: {
      notify: (msg, level) => notifications.push({ msg, level }),
      confirm,
    },
    getText: () => notifications.map((n) => n.msg).join("\n\n"),
  };
}

/**
 * Core logic for the todo_add tool. Exported for testability.
 */
export async function executeTodoAdd(
  cwd: string,
  title: string,
  description: string,
  storeName: string = TODO_STORE,
): Promise<TodoToolResult> {
  const { ui, getText } = collectNotifications();
  await handleAdd(["add", title, description], { cwd, storeName, ui }, { agentGenerated: true });
  return asToolResult(getText() || "No todo was added.");
}

/**
 * Core logic for the todo_list tool. Exported for testability.
 */
export function executeTodoList(cwd: string, storeName?: string): TodoToolResult {
  const result = formatTodoList(cwd, storeName);
  return asToolResult(result ?? "No open todos.");
}

/**
 * Core logic for the todo_design tool. Exported for testability.
 */
export async function executeTodoDesign(
  cwd: string,
  name: string,
  pi: ExtensionAPI,
  allSkills: Skills,
  overwriteExistingDesign: boolean = false,
  storeName: string = TODO_STORE,
): Promise<TodoToolResult> {
  let overwriteDeclined = false;
  const { ui, getText } = collectNotifications(async () => {
    overwriteDeclined = !overwriteExistingDesign;
    return overwriteExistingDesign;
  });
  await handleDesign(["design", name], { cwd, storeName, ui }, pi, allSkills);
  if (overwriteDeclined) return asToolResult(`Todo "${name}" already has a design; not overwritten.`);
  return asToolResult(getText() || `Started design generation for todo "${name}".`);
}

/**
 * Core logic for the todo_complete tool. Exported for testability.
 */
export async function executeTodoComplete(
  cwd: string,
  name: string,
  storeName: string = TODO_STORE,
): Promise<TodoToolResult> {
  const { ui, getText } = collectNotifications(async () => true);
  await handleComplete(["complete", name], { cwd, storeName, ui });
  return asToolResult(getText() || `Completed todo "${name}".`);
}

export function registerTodoTools(pi: ExtensionAPI, getSkills: () => Skills = () => []) {
  pi.registerTool(
    moduleTag(pi, "agent-todo", {
      name: "todo_add",
      label: "Todo Add",
      description:
        `${TODO_TOOL_USAGE_NOTICE} Add a new long-term todo item. ` +
        "Agent-created todos are stored with an AGENT- title prefix and an AGENT: description prefix.",
      parameters: Type.Object({
        title: Type.String({
          description:
            "Todo title/name supplied by the human request. The tool normalizes it and stores it with an AGENT- prefix.",
        }),
        description: Type.String({
          description: "Todo description supplied by the human request. The tool stores it with an AGENT: prefix.",
        }),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        if (signal?.aborted) return asToolResult("Cancelled");
        return executeTodoAdd(getCwd(ctx), params.title, params.description);
      },
    }),
  );

  pi.registerTool(
    moduleTag(pi, "agent-todo", {
      name: "todo_list",
      label: "Todo List",
      description:
        `${TODO_TOOL_USAGE_NOTICE} List all open long-term todo items for the project. ` +
        "Returns each todo's name, description, and whether it has a design.",
      parameters: Type.Object({}),
      async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
        if (signal?.aborted) return asToolResult("Cancelled");
        return executeTodoList(getCwd(ctx));
      },
    }),
  );

  pi.registerTool(
    moduleTag(pi, "agent-todo", {
      name: "todo_design",
      label: "Todo Design",
      description:
        `${TODO_TOOL_USAGE_NOTICE} Start the brainstorming/design workflow for an existing long-term todo. ` +
        "Only use this when the human explicitly asks to produce a design for a tracked long-term initiative.",
      parameters: Type.Object({
        name: Type.String({ description: "Exact todo name, as shown by todo_list." }),
        overwriteExistingDesign: Type.Optional(
          Type.Boolean({ description: "Whether to overwrite an existing design file for this todo. Defaults to false." }),
        ),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        if (signal?.aborted) return asToolResult("Cancelled");
        return executeTodoDesign(getCwd(ctx), params.name, pi, getSkills(), Boolean(params.overwriteExistingDesign));
      },
    }),
  );

  pi.registerTool(
    moduleTag(pi, "agent-todo", {
      name: "todo_complete",
      label: "Todo Complete",
      description:
        `${TODO_TOOL_USAGE_NOTICE} Mark an existing long-term todo complete. ` +
        "Only use this when the human explicitly asks to complete a tracked long-term initiative.",
      parameters: Type.Object({
        name: Type.String({ description: "Exact todo name, as shown by todo_list." }),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        if (signal?.aborted) return asToolResult("Cancelled");
        return executeTodoComplete(getCwd(ctx), params.name);
      },
    }),
  );
}

export const registerTodoTool = registerTodoTools;
