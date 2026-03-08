import { parse as parseYaml } from "yaml";
import type { ConfigFile, ConfigFileEntry, ConfigSkillEntry, ConfigWorkflowEntry } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseConfigFile(content: string): ConfigFile {
  const parsed = parseYaml(content) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Config file must parse to an object");
  }

  if (typeof parsed.name !== "string" || parsed.name.length === 0) {
    throw new Error("Config file must include a non-empty string 'name' field");
  }

  if (parsed.description != null && typeof parsed.description !== "string") {
    throw new Error("Field 'description' must be a string when provided");
  }

  const configs = parseConfigs(parsed.configs);
  const skills = parseSkills(parsed.skills);
  const workflows = parseWorkflows(parsed.workflows);

  const hasContent =
    (configs !== undefined && configs.length > 0) ||
    (skills !== undefined && skills.length > 0) ||
    (workflows !== undefined && workflows.length > 0);

  if (!hasContent) {
    throw new Error("Config file must include at least one of 'configs', 'skills', or 'workflows' with entries");
  }

  return {
    name: parsed.name,
    description: typeof parsed.description === "string" ? parsed.description : undefined,
    configs,
    skills,
    workflows,
  };
}

function parseConfigs(raw: unknown): ConfigFileEntry[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error("'configs' must be an array");
  }
  const configs: ConfigFileEntry[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (!isRecord(entry)) {
      throw new Error(`Config entry ${i} must be an object`);
    }
    if (typeof entry.name !== "string" || entry.name.length === 0) {
      throw new Error(`Config entry ${i} must have a string 'name'`);
    }
    if (typeof entry.value !== "string") {
      throw new Error(`Config entry ${i} ('${entry.name}') must have a string 'value'`);
    }
    configs.push({ name: entry.name, value: entry.value });
  }
  return configs.length > 0 ? configs : undefined;
}

function parseSkills(raw: unknown): ConfigSkillEntry[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error("'skills' must be an array");
  }
  const skills: ConfigSkillEntry[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (!isRecord(entry)) {
      throw new Error(`Skill entry ${i} must be an object`);
    }
    if (typeof entry.location !== "string" || entry.location.length === 0) {
      throw new Error(`Skill entry ${i} must have a string 'location'`);
    }
    skills.push({
      location: entry.location,
      module: typeof entry.module === "string" ? entry.module : undefined,
    });
  }
  return skills.length > 0 ? skills : undefined;
}

function parseWorkflows(raw: unknown): ConfigWorkflowEntry[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error("'workflows' must be an array");
  }
  const workflows: ConfigWorkflowEntry[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (!isRecord(entry)) {
      throw new Error(`Workflow entry ${i} must be an object`);
    }
    if (typeof entry.location !== "string" || entry.location.length === 0) {
      throw new Error(`Workflow entry ${i} must have a string 'location'`);
    }
    workflows.push({ location: entry.location });
  }
  return workflows.length > 0 ? workflows : undefined;
}
