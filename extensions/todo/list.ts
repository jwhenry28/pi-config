import { ensureStore, getEntry, listKeys } from "../memory/store.js";
import { TODO_STORE, type TodoExecutionContext } from "./constants.js";

export interface Todo {
  name: string;
  description: string;
  design: string;
}

/**
 * Fetch all open todos and return formatted bullet lines.
 * Returns null if there are no todos.
 */
export function formatTodoList(cwd: string, storeName: string = TODO_STORE): string | null {
  ensureStore(cwd, storeName);
  const keysResult = listKeys(cwd, storeName);
  if (keysResult.startsWith("Error") || keysResult.startsWith("Domain")) {
    return null;
  }

  const entries = keysResult
    .split("\n")
    .map((key) => key.trim())
    .filter(Boolean)
    .map((key) => {
      const raw = getEntry(cwd, storeName, key);
      if (raw.startsWith("Error")) {
        return null;
      }

      try {
        const todo = JSON.parse(raw) as Todo;
        return {
          sortKey: todo.name.toLowerCase(),
          line: `• ${todo.name} — ${todo.description}${todo.design ? " [has design]" : ""}`,
        };
      } catch {
        return {
          sortKey: key.toLowerCase(),
          line: `• ${key} — (invalid data)`,
        };
      }
    })
    .filter((entry): entry is { sortKey: string; line: string } => entry !== null)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return entries.length > 0 ? entries.map((entry) => entry.line).join("\n") : null;
}

export async function handleList(tex: TodoExecutionContext): Promise<void> {
  const result = formatTodoList(tex.cwd, tex.storeName);
  tex.ui.notify(result ?? "No open todos", "info");
}
