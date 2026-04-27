import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import YAML from "yaml";
import {
  ROSETTA_CONFIG_FILE,
  ROSETTA_EXECUTOR,
  ROSETTA_FOREIGN_EXTENSIONS_DIR,
} from "./constants.js";
import type {
  RosettaCommandConfig,
  RosettaCommandSubcommandConfig,
  RosettaConfig,
  RosettaLoadedExtension,
  RosettaToolConfig,
} from "./types.js";

export function getRosettaExtensionsDir(cwd: string): string {
  return join(cwd, ...ROSETTA_FOREIGN_EXTENSIONS_DIR);
}

export function discoverRosettaExtensions(cwd: string): RosettaLoadedExtension[] {
  return loadRosettaExtensions(cwd).extensions;
}

export function loadRosettaExtensions(cwd: string): {
  extensions: RosettaLoadedExtension[];
  warnings: string[];
} {
  const extensionsDir = getRosettaExtensionsDir(cwd);
  const hasExtensionsDir = existsSync(extensionsDir);
  if (!hasExtensionsDir) {
    return { extensions: [], warnings: [] };
  }

  const extensions: RosettaLoadedExtension[] = [];
  const warnings: string[] = [];
  const childNames = readdirSync(extensionsDir);

  for (const childName of childNames) {
    const extensionDir = join(extensionsDir, childName);
    const isDirectory = statSync(extensionDir).isDirectory();
    if (!isDirectory) {
      continue;
    }

    const configPath = join(extensionDir, ROSETTA_CONFIG_FILE);
    const hasConfig = existsSync(configPath);
    if (!hasConfig) {
      continue;
    }

    let raw: unknown;
    try {
      raw = YAML.parse(readFileSync(configPath, "utf8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Rosetta: failed to parse ${configPath}: ${message}`);
      continue;
    }

    const validationResult = validateRosettaConfig(raw, extensionDir);
    const isWarning = typeof validationResult === "string";
    if (isWarning) {
      warnings.push(`Rosetta: ${validationResult}`);
      continue;
    }

    extensions.push(validationResult);
  }

  return { extensions, warnings };
}

export function validateRosettaConfig(raw: unknown, extensionDir: string): RosettaLoadedExtension | string {
  const isObject = typeof raw === "object" && raw !== null && !Array.isArray(raw);
  if (!isObject) {
    return `invalid config in ${extensionDir}: top-level value must be an object`;
  }

  const config = raw as Partial<RosettaConfig>;

  const hasValidName = typeof config.name === "string" && config.name.trim().length > 0;
  if (!hasValidName) {
    return `invalid config in ${extensionDir}: name must be a non-empty string`;
  }

  const hasValidModule = typeof config.module === "string" && config.module.trim().length > 0;
  if (!hasValidModule) {
    return `invalid config in ${extensionDir}: module must be a non-empty string`;
  }

  const usesSupportedExecutor = config.executor === ROSETTA_EXECUTOR;
  if (!usesSupportedExecutor) {
    return `invalid config in ${extensionDir}: executor must be exactly "${ROSETTA_EXECUTOR}"`;
  }

  const hasValidEntrypoint = typeof config.entrypoint === "string" && config.entrypoint.trim().length > 0;
  if (!hasValidEntrypoint) {
    return `invalid config in ${extensionDir}: entrypoint must be a non-empty string`;
  }

  const hasToolList = Array.isArray(config.tools) && config.tools.length > 0;
  if (!hasToolList) {
    return `invalid config in ${extensionDir}: tools must be a non-empty array`;
  }

  const tools = validateRosettaTools(config.tools, extensionDir);
  const hasToolError = typeof tools === "string";
  if (hasToolError) {
    return tools;
  }

  const commands = validateRosettaCommands(config.commands, extensionDir);
  const hasCommandError = typeof commands === "string";
  if (hasCommandError) {
    return commands;
  }

  const resolvedEntrypoint = resolveRosettaEntrypoint(extensionDir, config.entrypoint);
  const hasEntrypointError = resolvedEntrypoint instanceof Error;
  if (hasEntrypointError) {
    return `invalid config in ${extensionDir}: ${resolvedEntrypoint.message}`;
  }

  return {
    name: config.name,
    module: config.module.trim(),
    directory: extensionDir,
    entrypoint: resolvedEntrypoint,
    tools,
    commands,
  };
}

export function resolveRosettaEntrypoint(extensionDir: string, entrypoint: string): string | Error {
  const resolved = resolve(extensionDir, entrypoint);
  const rel = relative(extensionDir, resolved);
  const parentSegment = `..${process.platform === "win32" ? "\\" : "/"}`;
  const escapes = rel === "" ? false : rel.startsWith("..") || rel.includes(parentSegment);
  if (escapes) {
    return new Error(`Entrypoint must stay inside extension directory: ${entrypoint}`);
  }

  return resolved;
}

function validateRosettaTools(rawTools: unknown[], extensionDir: string): RosettaToolConfig[] | string {
  const tools: RosettaToolConfig[] = [];

  for (let index = 0; index < rawTools.length; index += 1) {
    const rawTool = rawTools[index];
    const isObject = typeof rawTool === "object" && rawTool !== null && !Array.isArray(rawTool);
    if (!isObject) {
      return `invalid config in ${extensionDir}: tool at index ${index} must be an object`;
    }

    const tool = rawTool as Partial<RosettaToolConfig>;
    const hasName = typeof tool.name === "string" && tool.name.trim().length > 0;
    if (!hasName) {
      return `invalid config in ${extensionDir}: tool at index ${index} must have a non-empty string name`;
    }

    const hasDescription = typeof tool.description === "string" && tool.description.trim().length > 0;
    if (!hasDescription) {
      return `invalid config in ${extensionDir}: tool "${tool.name}" must have a non-empty string description`;
    }

    const hasInputSchema = typeof tool.input_schema === "object" && tool.input_schema !== null && !Array.isArray(tool.input_schema);
    if (!hasInputSchema) {
      return `invalid config in ${extensionDir}: tool "${tool.name}" must have an object input_schema`;
    }

    const argv = validateArgv(tool.argv, `tool "${tool.name}"`, extensionDir);
    const hasArgvError = typeof argv === "string";
    if (hasArgvError) {
      return argv;
    }

    tools.push({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema as Record<string, unknown>,
      argv,
    });
  }

  return tools;
}

function validateRosettaCommands(rawCommands: unknown, extensionDir: string): RosettaCommandConfig[] | string {
  if (rawCommands === undefined) {
    return [];
  }

  if (!Array.isArray(rawCommands)) {
    return `invalid config in ${extensionDir}: commands must be an array when provided`;
  }

  const commands: RosettaCommandConfig[] = [];
  for (let index = 0; index < rawCommands.length; index += 1) {
    const command = validateRosettaCommand(rawCommands[index], index, extensionDir);
    const hasCommandError = typeof command === "string";
    if (hasCommandError) {
      return command;
    }

    commands.push(command);
  }

  return commands;
}

function validateRosettaCommand(rawCommand: unknown, index: number, extensionDir: string): RosettaCommandConfig | string {
  const isObject = typeof rawCommand === "object" && rawCommand !== null && !Array.isArray(rawCommand);
  if (!isObject) {
    return `invalid config in ${extensionDir}: command at index ${index} must be an object`;
  }

  const command = rawCommand as Partial<RosettaCommandConfig>;
  const hasName = typeof command.name === "string" && command.name.trim().length > 0;
  if (!hasName) {
    return `invalid config in ${extensionDir}: command at index ${index} must have a non-empty string name`;
  }

  const hasDescription = typeof command.description === "string" && command.description.trim().length > 0;
  if (!hasDescription) {
    return `invalid config in ${extensionDir}: command "${command.name}" must have a non-empty string description`;
  }

  const subcommands = validateRosettaSubcommands(command.subcommands, command.name, extensionDir);
  const hasSubcommandError = typeof subcommands === "string";
  if (hasSubcommandError) {
    return subcommands;
  }

  return {
    name: command.name,
    description: command.description,
    subcommands,
  };
}

function validateRosettaSubcommands(
  rawSubcommands: unknown,
  commandName: string,
  extensionDir: string,
): RosettaCommandSubcommandConfig[] | string {
  if (!Array.isArray(rawSubcommands) || rawSubcommands.length === 0) {
    return `invalid config in ${extensionDir}: command "${commandName}" must have a non-empty subcommands array`;
  }

  const subcommands: RosettaCommandSubcommandConfig[] = [];
  for (let index = 0; index < rawSubcommands.length; index += 1) {
    const subcommand = validateRosettaSubcommand(rawSubcommands[index], commandName, index, extensionDir);
    const hasSubcommandError = typeof subcommand === "string";
    if (hasSubcommandError) {
      return subcommand;
    }

    subcommands.push(subcommand);
  }

  return subcommands;
}

function validateRosettaSubcommand(
  rawSubcommand: unknown,
  commandName: string,
  index: number,
  extensionDir: string,
): RosettaCommandSubcommandConfig | string {
  const isObject = typeof rawSubcommand === "object" && rawSubcommand !== null && !Array.isArray(rawSubcommand);
  if (!isObject) {
    return `invalid config in ${extensionDir}: subcommand at index ${index} for command "${commandName}" must be an object`;
  }

  const subcommand = rawSubcommand as Partial<RosettaCommandSubcommandConfig>;
  const hasName = typeof subcommand.name === "string" && subcommand.name.trim().length > 0;
  if (!hasName) {
    return `invalid config in ${extensionDir}: subcommand at index ${index} for command "${commandName}" must have a non-empty string name`;
  }

  const argv = validateArgv(subcommand.argv, `subcommand "${commandName} ${subcommand.name}"`, extensionDir);
  const hasArgvError = typeof argv === "string";
  if (hasArgvError) {
    return argv;
  }

  const hasInputSchema = typeof subcommand.input_schema === "object" && subcommand.input_schema !== null && !Array.isArray(subcommand.input_schema);
  if (!hasInputSchema) {
    return `invalid config in ${extensionDir}: subcommand "${commandName} ${subcommand.name}" must have an object input_schema`;
  }

  const usageError = validateOptionalString(subcommand.usage, "usage", commandName, subcommand.name, extensionDir);
  if (usageError) {
    return usageError;
  }

  return {
    name: subcommand.name,
    description: subcommand.description,
    argv,
    input_schema: subcommand.input_schema as Record<string, unknown>,
    usage: subcommand.usage,
  };
}

function validateArgv(rawArgv: unknown, label: string, extensionDir: string): string[] | string {
  if (rawArgv === undefined) {
    return [];
  }

  if (!Array.isArray(rawArgv)) {
    return `invalid config in ${extensionDir}: ${label} argv must be an array when provided`;
  }

  const hasInvalidArg = rawArgv.some((arg) => typeof arg !== "string" || arg.trim().length === 0);
  if (hasInvalidArg) {
    return `invalid config in ${extensionDir}: ${label} argv must contain only non-empty strings`;
  }

  return rawArgv;
}

function validateOptionalString(
  value: unknown,
  fieldName: string,
  commandName: string,
  subcommandName: string,
  extensionDir: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const isValid = typeof value === "string" && value.trim().length > 0;
  if (!isValid) {
    return `invalid config in ${extensionDir}: subcommand "${commandName} ${subcommandName}" ${fieldName} must be a non-empty string when provided`;
  }

  return undefined;
}
