import { parse as parseYaml } from "yaml";
import type { ParsedProfile, Profile, WorkflowModels } from "./types.js";

const KNOWN_WORKFLOW_MODEL_KEYS = new Set(["smart", "general", "fast"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateWorkflowModels(rawValue: unknown, warnings: string[]): WorkflowModels | undefined {
  if (rawValue == null) {
    return undefined;
  }

  if (!isRecord(rawValue)) {
    throw new Error("Field 'workflow_models' must be an object when provided");
  }

  const workflowModels: WorkflowModels = {};
  for (const [key, value] of Object.entries(rawValue)) {
    const isKnownKey = KNOWN_WORKFLOW_MODEL_KEYS.has(key);
    if (!isKnownKey) {
      warnings.push(`Unknown workflow_models key: ${key}`);
    }

    if (typeof value !== "string") {
      throw new Error(`workflow_models.${key} must be a string`);
    }

    workflowModels[key] = value;
  }

  return workflowModels;
}

export function parseAndValidateProfile(content: string): ParsedProfile {
  const parsed = parseYaml(content) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Profile file must parse to an object");
  }

  const warnings: string[] = [];

  if (typeof parsed.name !== "string" || parsed.name.length === 0) {
    throw new Error("Profile must include a non-empty string 'name' field");
  }

  if (parsed.description != null && typeof parsed.description !== "string") {
    throw new Error("Field 'description' must be a string when provided");
  }

  const workflowModels = validateWorkflowModels(parsed.workflow_models, warnings);

  const profile: Profile = {
    ...parsed,
    name: parsed.name,
    description: typeof parsed.description === "string" ? parsed.description : undefined,
    workflow_models: workflowModels,
  };

  return { profile, warnings };
}
