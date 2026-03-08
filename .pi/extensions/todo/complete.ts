import { existsSync, unlinkSync } from "node:fs";
import { ensureStore, getEntry, deleteEntry } from "../memory/store.js";
import { NAME_RE, type TodoExecutionContext } from "./constants.js";

export async function handleComplete(parts: string[], tex: TodoExecutionContext): Promise<void> {
  const name = parts[1];
  if (!name) {
    tex.ui.notify("Usage: /todo complete <name>", "warning");
    return;
  }
  if (!NAME_RE.test(name)) {
    tex.ui.notify(`Invalid name "${name}". Names must match [a-zA-Z0-9_-]+.`, "error");
    return;
  }
  ensureStore(tex.cwd, tex.storeName);
  const raw = getEntry(tex.cwd, tex.storeName, name);
  if (raw.startsWith("Error")) {
    tex.ui.notify(`Todo "${name}" not found.`, "error");
    return;
  }
  let designPath = "";
  try {
    const todo = JSON.parse(raw) as { name: string; description: string; design: string };
    designPath = todo.design;
  } catch {
    // proceed with deletion even if JSON is malformed
  }
  const confirmMsg = designPath
    ? `Complete todo "${name}"? This will also delete the design file at ${designPath}.`
    : `Complete todo "${name}"?`;
  const confirmed = await tex.ui.confirm("Complete todo", confirmMsg);
  if (!confirmed) {
    tex.ui.notify("Cancelled", "info");
    return;
  }
  if (designPath && existsSync(designPath)) {
    unlinkSync(designPath);
  }
  deleteEntry(tex.cwd, tex.storeName, name);
  tex.ui.notify(`Completed todo "${name}"`, "info");
}
