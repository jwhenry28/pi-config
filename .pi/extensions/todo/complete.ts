import { existsSync, unlinkSync } from "node:fs";
import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { ensureDomain, getEntry, deleteEntry } from "../memory/store.js";
import { TODO_DOMAIN, NAME_RE } from "./constants.js";

export async function handleComplete(parts: string[], ctx: ExtensionCommandContext): Promise<void> {
  const name = parts[1];
  if (!name) {
    ctx.ui.notify("Usage: /todo complete <name>", "warning");
    return;
  }
  if (!NAME_RE.test(name)) {
    ctx.ui.notify(`Invalid name "${name}". Names must match [a-zA-Z0-9_-]+.`, "error");
    return;
  }
  ensureDomain(ctx.cwd, TODO_DOMAIN);
  const raw = getEntry(ctx.cwd, TODO_DOMAIN, name);
  if (raw.startsWith("Error")) {
    ctx.ui.notify(`Todo "${name}" not found.`, "error");
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
  const confirmed = await ctx.ui.confirm("Complete todo", confirmMsg);
  if (!confirmed) {
    ctx.ui.notify("Cancelled", "info");
    return;
  }
  if (designPath && existsSync(designPath)) {
    unlinkSync(designPath);
  }
  deleteEntry(ctx.cwd, TODO_DOMAIN, name);
  ctx.ui.notify(`Completed todo "${name}"`, "info");
}
