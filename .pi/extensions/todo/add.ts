import { ensureStore, addEntry, getEntry } from "../memory/store.js";
import { NAME_RE, type TodoExecutionContext } from "./constants.js";

export async function handleAdd(
  parts: string[],
  tex: TodoExecutionContext,
): Promise<void> {
  const name = parts[1];
  const description = parts.slice(2).join(" ");
  if (!name || !description) {
    tex.ui.notify("Usage: /todo add <name> <description>", "warning");
    return;
  }
  if (!NAME_RE.test(name)) {
    tex.ui.notify(`Invalid name "${name}". Names must match [a-zA-Z0-9_-]+.`, "error");
    return;
  }
  ensureStore(tex.cwd, tex.storeName);
  const existing = getEntry(tex.cwd, tex.storeName, name);
  if (!existing.startsWith("Error")) {
    tex.ui.notify(`Todo "${name}" already exists. Use /todo complete to complete it first.`, "warning");
    return;
  }
  const todo = JSON.stringify({ name, description, design: "" });
  addEntry(tex.cwd, tex.storeName, name, todo);
  tex.ui.notify(`Added todo "${name}"`, "info");
}
