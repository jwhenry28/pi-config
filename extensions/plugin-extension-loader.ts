import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getEnabledPlugins } from "./shared/plugins.js";
import { getPluginsDir } from "./shared/home.js";
import { getCwd } from "./shared/cwd.js";

export default function pluginExtensionLoader(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const cwd = getCwd(ctx);
    const enabled = getEnabledPlugins(cwd);

    for (const name of enabled) {
      const extDir = join(getPluginsDir(), name, "extensions");
      if (!existsSync(extDir)) continue;

      for (const entry of readdirSync(extDir, { withFileTypes: true })) {
        let target: string | null = null;
        if (entry.isDirectory() && existsSync(join(extDir, entry.name, "index.ts"))) {
          target = join(extDir, entry.name, "index.ts");
        } else if (entry.isFile() && entry.name.endsWith(".ts")) {
          target = join(extDir, entry.name);
        }
        if (!target) continue;

        try {
          const mod = await import(target);
          if (typeof mod.default === "function") mod.default(pi);
        } catch (err) {
          ctx.ui.notify(`Failed to load plugin extension "${name}": ${(err as Error).message}`, "warning");
        }
      }
    }
  });
}
