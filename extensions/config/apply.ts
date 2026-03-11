import { writeKey, deleteEntry } from "../memory/store.js";
import { findEntry } from "./registry.js";
import type { ApplyResult, ConfigFile, ConfigExecutionContext } from "./types.js";

export function applyConfigFile(file: ConfigFile, ctx: ConfigExecutionContext): ApplyResult {
  const warnings: string[] = [];
  const updatedKeys: string[] = [];

  if (file.configs) {
    for (const entry of file.configs) {
      const registryEntry = findEntry(entry.name);
      if (!registryEntry) {
        warnings.push(`Unknown config key: ${entry.name} (skipped)`);
        continue;
      }

      if (registryEntry.validator) {
        registryEntry.validator(entry.value, ctx);
      }

      writeKey(ctx.cwd, ctx.storeName, entry.name, entry.value);
      updatedKeys.push(entry.name);
    }
  }

  writeKey(ctx.cwd, ctx.storeName, "active-config", file.name);

  return { updatedKeys, warnings };
}

export function unapplyConfigFile(file: ConfigFile, ctx: ConfigExecutionContext): ApplyResult {
  const warnings: string[] = [];
  const updatedKeys: string[] = [];

  if (file.configs) {
    for (const entry of file.configs) {
      deleteEntry(ctx.cwd, ctx.storeName, entry.name);
      updatedKeys.push(entry.name);
    }
  }

  deleteEntry(ctx.cwd, ctx.storeName, "active-config");

  return { updatedKeys, warnings };
}
