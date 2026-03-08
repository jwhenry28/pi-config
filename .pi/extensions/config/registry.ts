import { parseModelRef } from "../workflow/models.js";
import type { ConfigEntry, ConfigExecutionContext } from "./types.js";

function validateModelReference(value: string, ctx: ConfigExecutionContext): void {
  const trimmed = value.trim();
  if (!trimmed.length) {
    throw new Error("Model value cannot be empty");
  }

  const { provider, modelId } = parseModelRef(trimmed);
  const allModels = ctx.modelRegistry.getAll();

  if (!provider) {
    const exists = allModels.some((model) => model.id === modelId);
    if (!exists) {
      throw new Error(`Model not found in registry: ${value}`);
    }
    return;
  }

  if (typeof ctx.modelRegistry.find !== "function") {
    throw new Error(`Provider-qualified model references are not supported: ${value}`);
  }

  if (!ctx.modelRegistry.find(provider, modelId)) {
    throw new Error(`Model not found in registry: ${value}`);
  }
}

const REGISTRY: ConfigEntry[] = [
  {
    name: "smart",
    description: "Model alias for complex tasks",
    default: "claude-opus-4-6",
    validator: validateModelReference,
  },
  {
    name: "general",
    description: "Model alias for standard tasks",
    default: "claude-sonnet-4-6",
    validator: validateModelReference,
  },
  {
    name: "fast",
    description: "Model alias for simple tasks",
    default: "claude-haiku-4-5",
    validator: validateModelReference,
  },
];

export function getRegistry(): ConfigEntry[] {
  return REGISTRY;
}

export function findEntry(name: string): ConfigEntry | undefined {
  return REGISTRY.find((entry) => entry.name === name);
}

export function getAllNames(): string[] {
  return REGISTRY.map((entry) => entry.name);
}
