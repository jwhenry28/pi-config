import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getCwd } from "../shared/cwd.js";
import { loadRosettaExtensions } from "./config.js";
import { executePythonTool } from "./runtime.js";

export default function rosettaExtension(pi: ExtensionAPI) {
  let loaded = false;
  const registeredToolNames = new Set<string>();

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
      for (const tool of extension.tools) {
        const isDuplicateTool = registeredToolNames.has(tool.name);
        if (isDuplicateTool) {
          warn(ctx, `Rosetta: skipping duplicate tool "${tool.name}" from ${extension.name}`);
          continue;
        }

        try {
          pi.registerTool({
            name: tool.name,
            label: tool.name,
            description: tool.description,
            parameters: tool.input_schema as any,
            async execute(_toolCallId, params) {
              const text = await executePythonTool(extension.entrypoint, params ?? {});
              return {
                content: [{ type: "text" as const, text }],
                details: {
                  extension: extension.name,
                  entrypoint: extension.entrypoint,
                },
              };
            },
          });
          registeredToolNames.add(tool.name);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          warn(ctx, `Rosetta: skipping tool "${tool.name}" because registration failed: ${message}`);
        }
      }
    }
  });
}

function warn(ctx: { ui?: { notify?: (msg: string, level: "info" | "warning" | "error") => void } } | undefined, message: string) {
  ctx?.ui?.notify?.(message, "warning");
}
