import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import YAML from "yaml";
import {
  ROSETTA_CONFIG_FILE,
  ROSETTA_EXECUTOR,
  ROSETTA_FOREIGN_EXTENSIONS_DIR,
} from "./constants.js";
import type { RosettaConfig, RosettaLoadedExtension, RosettaToolConfig } from "./types.js";

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

  const resolvedEntrypoint = resolveRosettaEntrypoint(extensionDir, config.entrypoint);
  const hasEntrypointError = resolvedEntrypoint instanceof Error;
  if (hasEntrypointError) {
    return `invalid config in ${extensionDir}: ${resolvedEntrypoint.message}`;
  }

  return {
    name: config.name,
    directory: extensionDir,
    entrypoint: resolvedEntrypoint,
    tools,
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

    tools.push({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema as Record<string, unknown>,
    });
  }

  return tools;
}
