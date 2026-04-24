import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getCwd } from "../shared/cwd.js";
import { loadRosettaExtensions } from "./config.js";
import { executePythonTool } from "./runtime.js";
import type { RosettaCommandConfig, RosettaCommandSubcommandConfig, RosettaLoadedExtension } from "./types.js";

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

function registerRosettaTools(
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
      pi.registerTool({
        name: tool.name,
        label: tool.name,
        description: tool.description,
        parameters: tool.input_schema as any,
        async execute(_toolCallId, params) {
          const text = await executePythonTool(extension.entrypoint, params ?? {}, tool.argv);
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

function registerRosettaCommands(
  pi: ExtensionAPI,
  ctx: RosettaNotifyContext | undefined,
  extension: RosettaLoadedExtension,
  registeredCommandNames: Set<string>,
): void {
  for (const command of extension.commands) {
    const isDuplicateCommand = registeredCommandNames.has(command.name);
    if (isDuplicateCommand) {
      warn(ctx, `Rosetta: skipping duplicate command "/${command.name}" from ${extension.name}`);
      continue;
    }

    try {
      pi.registerCommand(command.name, {
        description: command.description,
        handler: async (args, commandCtx) => handleRosettaCommand(args, commandCtx, extension, command),
      });
      registeredCommandNames.add(command.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warn(ctx, `Rosetta: skipping command "/${command.name}" because registration failed: ${message}`);
    }
  }
}

async function handleRosettaCommand(
  args: string,
  ctx: RosettaNotifyContext,
  extension: RosettaLoadedExtension,
  command: RosettaCommandConfig,
): Promise<void> {
  const parsedArgs = parseRosettaCommandArgs(args);
  if (!parsedArgs.subcommand || parsedArgs.subcommand === "help") {
    notify(ctx, buildCommandUsage(command), "info");
    return;
  }

  const subcommand = command.subcommands.find((candidate) => candidate.name === parsedArgs.subcommand);
  if (!subcommand) {
    notify(ctx, `Unknown subcommand: ${parsedArgs.subcommand}.\n\n${buildCommandUsage(command)}`, "warning");
    return;
  }

  const parameters = buildCommandParameters(subcommand, parsedArgs.rest);
  if (parameters instanceof Error) {
    notify(ctx, `${parameters.message}\n\n${buildSubcommandUsage(command, subcommand)}`, "warning");
    return;
  }

  try {
    const result = await executePythonTool(extension.entrypoint, parameters, subcommand.argv);
    notify(ctx, formatCommandSuccessMessage(result), "info");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    notify(ctx, message, "warning");
  }
}

function parseRosettaCommandArgs(args: string): { subcommand: string; rest: string } {
  const trimmedArgs = args.trimStart();
  const separatorIndex = trimmedArgs.search(/\s/);
  if (separatorIndex === -1) {
    return { subcommand: trimmedArgs, rest: "" };
  }

  return {
    subcommand: trimmedArgs.slice(0, separatorIndex),
    rest: trimmedArgs.slice(separatorIndex).trim(),
  };
}

function buildCommandParameters(subcommand: RosettaCommandSubcommandConfig, rest: string): Record<string, unknown> | Error {
  if (!subcommand.rest_parameter) {
    return {};
  }

  if (rest.length === 0) {
    return new Error(`Missing required argument: ${subcommand.rest_parameter}`);
  }

  return { [subcommand.rest_parameter]: rest };
}

function buildCommandUsage(command: RosettaCommandConfig): string {
  const lines = [`Usage: /${command.name} <subcommand> [args...]`, ""];
  for (const subcommand of command.subcommands) {
    lines.push(`  ${buildSubcommandUsage(command, subcommand).replace(`Usage: /${command.name} `, "")}`);
  }
  lines.push("", `Use /${command.name} help to show this message.`);
  return lines.join("\n");
}

function buildSubcommandUsage(command: RosettaCommandConfig, subcommand: RosettaCommandSubcommandConfig): string {
  if (subcommand.usage) {
    return subcommand.usage;
  }

  const restArgument = subcommand.rest_parameter ? ` <${subcommand.rest_parameter}>` : "";
  return `Usage: /${command.name} ${subcommand.name}${restArgument}`;
}

function formatCommandSuccessMessage(result: string): string {
  const parsedResult = parseJsonObject(result);
  const hasNameAndPath = typeof parsedResult?.name === "string" && typeof parsedResult?.path === "string";
  if (hasNameAndPath) {
    return `Created "${parsedResult.name}" at ${parsedResult.path}`;
  }

  return result;
}

function parseJsonObject(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function warn(ctx: RosettaNotifyContext | undefined, message: string): void {
  notify(ctx, message, "warning");
}

function notify(ctx: RosettaNotifyContext | undefined, message: string, level: "info" | "warning" | "error"): void {
  ctx?.ui?.notify?.(message, level);
}

type RosettaNotifyContext = {
  ui?: {
    notify?: (msg: string, level: "info" | "warning" | "error") => void;
  };
};
