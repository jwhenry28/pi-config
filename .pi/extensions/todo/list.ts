import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { ensureDomain, getEntry, listKeys } from "../memory/store.js";
import { TODO_DOMAIN } from "./constants.js";

export async function handleList(ctx: ExtensionCommandContext): Promise<void> {
  ensureDomain(ctx.cwd, TODO_DOMAIN);
  const keysResult = listKeys(ctx.cwd, TODO_DOMAIN);
  if (keysResult.startsWith("Error") || keysResult.startsWith("Domain")) {
    ctx.ui.notify("No open todos", "info");
    return;
  }
  const keys = keysResult.split("\n");
  const lines: string[] = [];
  for (const key of keys) {
    const raw = getEntry(ctx.cwd, TODO_DOMAIN, key);
    if (raw.startsWith("Error")) continue;
    try {
      const todo = JSON.parse(raw) as { name: string; description: string; design: string };
      const tag = todo.design ? " [has design]" : "";
      lines.push(`• ${todo.name} — ${todo.description}${tag}`);
    } catch {
      lines.push(`• ${key} — (invalid data)`);
    }
  }
  if (lines.length === 0) {
    ctx.ui.notify("No open todos", "info");
    return;
  }
  ctx.ui.notify(lines.join("\n"), "info");
}
