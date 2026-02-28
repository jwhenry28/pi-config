/**
 * Custom startup header extension.
 *
 * Adds a [Modules] section to the startup info, displayed after
 * the built-in [Skills] and [Extensions] sections.
 *
 * Each module shows its load status:
 *   * module-name   (green, loaded)
 *   - module-name   (dim, not loaded)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { ModuleContents } from "./modules/registry.js";

export default function (pi: ExtensionAPI) {
  pi.registerMessageRenderer("startup-modules", (message, _options, theme) => {
    const details = message.details as {
      modules: Array<{ name: string; loaded: boolean }>;
    };

    if (!details?.modules?.length) return undefined;

    const header = theme.fg("mdHeading", "[Modules]");
    const lines = details.modules.map(({ name, loaded }) => {
      if (loaded) {
        return `    ${theme.fg("success", "*")} ${theme.fg("dim", name)}`;
      }
      return `    ${theme.fg("dim", `- ${name}`)}`;
    });

    return new Text(`${header}\n${lines.join("\n")}`, 0, 0);
  });

  function emitModulesHeader() {
    let loaded: string[] = [];
    let modules: Map<string, ModuleContents> = new Map();

    pi.events.emit("module:get-state", {
      callback: (info: { loaded: string[]; modules: Map<string, ModuleContents> }) => {
        loaded = info.loaded;
        modules = info.modules;
      },
    });

    const names = Array.from(modules.keys()).sort();
    if (names.length === 0) return;

    const moduleList = names.map((name) => ({
      name,
      loaded: loaded.includes(name),
    }));

    pi.sendMessage({
      customType: "startup-modules",
      content: "",
      display: true,
      details: { modules: moduleList },
    });
  }

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    // Only show on fresh sessions — resumed sessions already have
    // the startup-modules message persisted from the original start.
    const hasModulesMessage = ctx.sessionManager.getBranch().some(
      (e) => e.type === "message" && e.message.role === "custom" && e.message.customType === "startup-modules",
    );
    if (hasModulesMessage) return;

    // Defer so the message appears after the built-in [Skills]/[Extensions]
    setTimeout(() => emitModulesHeader(), 0);
  });
}
