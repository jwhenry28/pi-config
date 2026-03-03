import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { writeKey } from "../memory/store.js";
import { parseModelRef } from "../workflow/models.js";
import type { ApplyResult, Profile } from "./types.js";

const WORKFLOW_MODELS_DOMAIN = "workflow_models";
const PROFILE_CONFIG_DOMAIN = "pi-config";
const ACTIVE_PROFILE_KEY = "active-profile";
const MODEL_KEYS = ["smart", "general", "fast"] as const;

function validateModelReference(modelRef: string, ctx: ExtensionContext): void {
  const trimmedModelRef = modelRef.trim();
  const hasValue = trimmedModelRef.length > 0;
  if (!hasValue) {
    throw new Error("Model value cannot be empty");
  }

  const { provider, modelId } = parseModelRef(trimmedModelRef);
  const allModels = ctx.modelRegistry.getAll();
  const registryAny = ctx.modelRegistry as any;

  if (!provider) {
    const existsById = allModels.some((model) => model.id === modelId);
    if (!existsById) {
      throw new Error(`Model not found in registry: ${modelRef}`);
    }
    return;
  }

  const canLookupByProvider = typeof registryAny.find === "function";
  if (!canLookupByProvider) {
    throw new Error(`Provider-qualified model references are not supported: ${modelRef}`);
  }

  const existsByProviderAndId = !!registryAny.find(provider, modelId);
  if (!existsByProviderAndId) {
    throw new Error(`Model not found in registry: ${modelRef}`);
  }
}

export function applyProfile(profile: Profile, ctx: ExtensionContext, schemaWarnings: string[]): ApplyResult {
  const warnings = [...schemaWarnings];
  const updatedKeys: string[] = [];
  const models = profile.workflow_models;

  if (!models) {
    writeKey(ctx.cwd, PROFILE_CONFIG_DOMAIN, ACTIVE_PROFILE_KEY, profile.name);
    return { updatedKeys, warnings };
  }

  for (const key of MODEL_KEYS) {
    const rawValue = models[key];
    if (typeof rawValue !== "string") {
      continue;
    }

    validateModelReference(rawValue, ctx);
    writeKey(ctx.cwd, WORKFLOW_MODELS_DOMAIN, key, rawValue);
    updatedKeys.push(key);
  }

  writeKey(ctx.cwd, PROFILE_CONFIG_DOMAIN, ACTIVE_PROFILE_KEY, profile.name);
  return { updatedKeys, warnings };
}
