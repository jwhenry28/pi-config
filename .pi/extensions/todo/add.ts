import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { ensureDomain, addEntry, getEntry } from "../memory/store.js";
import { TODO_DOMAIN, NAME_RE } from "./constants.js";

export async function handleAdd(parts: string[], ctx: ExtensionCommandContext): Promise<void> {
  const name = parts[1];
  const description = parts.slice(2).join(" ");
  if (!name || !description) {
    ctx.ui.notify("Usage: /todo add <name> <description>", "warning");
    return;
  }
  if (!NAME_RE.test(name)) {
    ctx.ui.notify(`Invalid name "${name}". Names must match [a-zA-Z0-9_-]+.`, "error");
    return;
  }
  ensureDomain(ctx.cwd, TODO_DOMAIN);
  const existing = getEntry(ctx.cwd, TODO_DOMAIN, name);
  if (!existing.startsWith("Error")) {
    ctx.ui.notify(`Todo "${name}" already exists. Use /todo remove to delete it first.`, "warning");
    return;
  }
  const todo = JSON.stringify({ name, description, design: "" });
  addEntry(ctx.cwd, TODO_DOMAIN, name, todo);
  ctx.ui.notify(`Added todo "${name}"`, "info");
}
