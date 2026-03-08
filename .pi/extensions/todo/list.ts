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
  const keys = keysResult.split("\n");
  const lines: string[] = [];
  for (const key of keys) {
    const raw = getEntry(cwd, storeName, key);
    if (raw.startsWith("Error")) continue;
    try {
      const todo = JSON.parse(raw) as Todo;
      const tag = todo.design ? " [has design]" : "";
      lines.push(`• ${todo.name} — ${todo.description}${tag}`);
    } catch {
      lines.push(`• ${key} — (invalid data)`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

export async function handleList(tex: TodoExecutionContext): Promise<void> {
  const result = formatTodoList(tex.cwd, tex.storeName);
  tex.ui.notify(result ?? "No open todos", "info");
}
