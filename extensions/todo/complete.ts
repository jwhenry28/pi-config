import { existsSync, unlinkSync } from "node:fs";
import { ensureStore, getEntry, deleteEntry, readStore } from "../memory/store.js";
import { NAME_RE, type TodoExecutionContext } from "./constants.js";
import type { AutocompleteItem } from "@mariozechner/pi-tui";

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

/**
 * Return autocomplete items for a subcommand that takes a todo name argument.
 * @param cwd - Project root directory
 * @param storeName - Name of the todo memory store
 * @param subcommand - The subcommand to prefix in the value (e.g. "complete", "design")
 * @param partial - The partial todo name typed so far (text after "<subcommand> ")
 * @returns Matching AutocompleteItem[] or null if none match
 */
export function getTodoCompletions(
  cwd: string,
  storeName: string,
  subcommand: string,
  partial: string,
): AutocompleteItem[] | null {
  const data = readStore(cwd, storeName);
  if (!data) return null;

  const keys = Object.keys(data.entries);
  if (keys.length === 0) return null;

  const matches: AutocompleteItem[] = [];
  for (const key of keys) {
    if (!key.startsWith(partial)) continue;

    let description = "";
    try {
      const raw = Buffer.from(data.entries[key], "base64").toString("utf-8");
      const todo = JSON.parse(raw) as { description?: string };
      description = todo.description ?? "";
    } catch {
      // skip description if JSON is malformed
    }

    matches.push({
      value: `${subcommand} ${key}`,
      label: key,
      description,
    });
  }

  return matches.length > 0 ? matches : null;
}
