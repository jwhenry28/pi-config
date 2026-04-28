import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getCwd } from "../shared/cwd.js";
import { registerRosettaCommands } from "./commands.js";
import { loadRosettaExtensions } from "./config.js";
import { registerRosettaTools } from "./tools.js";
import { warn } from "./utils.js";

export default function rosettaExtension(pi: ExtensionAPI) {
  let loaded = false;
  const registeredToolNames = new Set<string>();
  const registeredCommandNames = new Set<string>();

  pi.on("session_start", async (_event, ctx) => {
    if (loaded) {
      return;
    }

    loaded = true;
    const cwd = getCwd(ctx);
    const { extensions, warnings } = loadRosettaExtensions(cwd);

    for (const warning of warnings) {
      warn(ctx, warning);
    }

    for (const extension of extensions) {
      registerRosettaTools(pi, ctx, extension, registeredToolNames);
      registerRosettaCommands(pi, ctx, extension, registeredCommandNames);
    }
  });
}
