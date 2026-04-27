import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { executePythonTool } from "./runtime.js";
import { tokenizeCommandInput } from "./tokenizer.js";
import type { RosettaCommandConfig, RosettaCommandSubcommandConfig, RosettaLoadedExtension } from "./types.js";
import { notify, warn, type RosettaNotifyContext } from "./utils.js";

export function registerRosettaCommands(
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
  const tokenized = tokenizeCommandInput(rest);
  if (tokenized instanceof Error) {
    return tokenized;
  }

  return parseFlagParameters(subcommand, tokenized);
}

function parseFlagParameters(
  subcommand: RosettaCommandSubcommandConfig,
  tokens: string[],
): Record<string, unknown> | Error {
  const parameters: Record<string, unknown> = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--") || token.length <= 2) {
      return new Error(`Unexpected positional argument: ${token}`);
    }

    const flagName = token.slice(2);
    if (Object.prototype.hasOwnProperty.call(parameters, flagName)) {
      return new Error(`Duplicate flag: --${flagName}`);
    }

    const nextToken = tokens[index + 1];
    const propertySchema = getSchemaProperty(subcommand.input_schema, flagName);
    const declaredType = getSchemaType(propertySchema);
    const isBooleanFlag = declaredType === "boolean";

    if (!isBooleanFlag && (nextToken === undefined || nextToken.startsWith("--"))) {
      return new Error(`Missing value for flag: --${flagName}`);
    }

    if (isBooleanFlag && (nextToken === undefined || nextToken.startsWith("--"))) {
      parameters[flagName] = true;
      continue;
    }

    parameters[flagName] = nextToken;
    index += 1;
  }

  return parameters;
}

function getSchemaProperty(schema: Record<string, unknown>, flagName: string): Record<string, unknown> | undefined {
  const properties = schema.properties;
  const hasObjectProperties = typeof properties === "object" && properties !== null && !Array.isArray(properties);
  if (!hasObjectProperties) {
    return undefined;
  }

  const property = (properties as Record<string, unknown>)[flagName];
  const isObjectProperty = typeof property === "object" && property !== null && !Array.isArray(property);
  return isObjectProperty ? (property as Record<string, unknown>) : undefined;
}

function getSchemaType(schema: Record<string, unknown> | undefined): string | undefined {
  return typeof schema?.type === "string" ? schema.type : undefined;
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

  const flagUsage = buildSchemaFlagUsage(subcommand.input_schema);
  return `Usage: /${command.name} ${subcommand.name}${flagUsage}`;
}

function buildSchemaFlagUsage(schema: Record<string, unknown>): string {
  const propertyNames = getSchemaPropertyNames(schema);
  if (propertyNames.length === 0) {
    return "";
  }

  const requiredNames = getRequiredPropertyNames(schema, propertyNames);
  const optionalNames = propertyNames.filter((propertyName) => !requiredNames.includes(propertyName));
  const requiredUsage = requiredNames.map(formatRequiredFlagUsage);
  const optionalUsage = optionalNames.map(formatOptionalFlagUsage);
  return ` ${[...requiredUsage, ...optionalUsage].join(" ")}`;
}

function getSchemaPropertyNames(schema: Record<string, unknown>): string[] {
  const properties = schema.properties;
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
    return [];
  }

  return Object.keys(properties);
}

function getRequiredPropertyNames(schema: Record<string, unknown>, propertyNames: string[]): string[] {
  if (!Array.isArray(schema.required)) {
    return [];
  }

  return schema.required.filter((propertyName): propertyName is string => {
    return typeof propertyName === "string" && propertyNames.includes(propertyName);
  });
}

function formatRequiredFlagUsage(propertyName: string): string {
  return `--${propertyName} <${propertyName}>`;
}

function formatOptionalFlagUsage(propertyName: string): string {
  return `[--${propertyName} <${propertyName}>]`;
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
