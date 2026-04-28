import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { moduleTag } from "../modules/api.js";
import { executePythonTool } from "./runtime.js";
import type { RosettaLoadedExtension } from "./types.js";
import { warn, type RosettaNotifyContext } from "./utils.js";

export function registerRosettaTools(
  pi: ExtensionAPI,
  ctx: RosettaNotifyContext | undefined,
  extension: RosettaLoadedExtension,
  registeredToolNames: Set<string>,
): void {
  for (const tool of extension.tools) {
    const isDuplicateTool = registeredToolNames.has(tool.name);
    if (isDuplicateTool) {
      warn(ctx, `Rosetta: skipping duplicate tool "${tool.name}" from ${extension.name}`);
      continue;
    }

    try {
      pi.registerTool(moduleTag(pi, extension.module, {
        name: tool.name,
        label: tool.name,
        description: tool.description,
        parameters: tool.input_schema as any,
        async execute(_toolCallId, params) {
          const text = await executePythonTool(extension.entrypoint, params ?? {}, tool.argv, { throwOnJsonError: false });
          return {
            content: [{ type: "text" as const, text }],
            details: {
              extension: extension.name,
              entrypoint: extension.entrypoint,
            },
          };
        },
      }));
      registeredToolNames.add(tool.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warn(ctx, `Rosetta: skipping tool "${tool.name}" because registration failed: ${message}`);
    }
  }
}
