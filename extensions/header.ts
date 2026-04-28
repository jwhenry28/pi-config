/**
 * Custom startup header extension.
 *
 * Adds a [Modules] section to the startup info, displayed after
 * the built-in [Skills] and [Extensions] sections.
 *
 * Each module shows its visibility status:
 *   * module-name   (shown)
 *   - module-name   (hidden)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { ModuleContents } from "./modules/registry.js";
import { formatModulesBlock } from "./modules/display.js";
import { getCwd } from "./shared/cwd.js";

export default function (pi: ExtensionAPI) {
  pi.registerMessageRenderer("startup-modules", (message, _options, theme) => {
    const details = message.details as {
      modules: Array<{ name: string; shown: boolean }>;
    };

    if (!details?.modules?.length) return undefined;

    const text = formatModulesBlock(details.modules, {
      formatHeader: (text) => theme.fg("mdHeading", text),
      formatShownLine: (name) => `${theme.fg("success", "*")} ${theme.fg("dim", name)}`,
      formatHiddenLine: (name) => theme.fg("dim", `- ${name}`),
    });
    return new Text(text, 0, 0);
  });

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    const cwd = getCwd(ctx);

    // Only show on fresh sessions — resumed sessions already have
    // the startup-modules message persisted from the original start.
    const hasModulesMessage = ctx.sessionManager.getBranch().some(
      (e) => e.type === "message" && e.message.role === "custom" && e.message.customType === "startup-modules",
    );
    if (hasModulesMessage) return;

    const sendStartupModules = () => {
      let shown: string[] = [];
      let modules: Map<string, ModuleContents> = new Map();

      pi.events.emit("module:get-state", {
        // The header can run before the modules extension's own session_start
        // handler. Pass the session cwd so the modules extension can hydrate
        // skill-backed modules before answering this startup query.
        cwd,
        callback: (info: { shown: string[]; modules: Map<string, ModuleContents> }) => {
          shown = info.shown;
          modules = info.modules;
        },
      });

      const names = Array.from(modules.keys()).sort();
      if (names.length === 0) return;

      const moduleList = names.map((name) => ({
        name,
        shown: shown.includes(name),
      }));

      pi.sendMessage({
        customType: "startup-modules",
        content: "",
        display: true,
        details: { modules: moduleList },
      });
    };

    // Defer until after pi has rendered the built-in startup resource block
    // ([Skills], [Extensions], etc.), so [Modules] appears at the bottom of
    // that header rather than before it.
    setTimeout(() => {
      try {
        sendStartupModules();
      } catch {
        // The deferred render can outlive short-lived test/reload sessions.
        // If the extension context has gone stale, just skip the startup block.
      }
    }, 0);
  });
}
