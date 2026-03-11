import { readKey, writeKey } from "../memory/store.js";

const MEMORY_DOMAIN = "pi-config";
const MEMORY_KEY = "plugin-repos";

/**
 * Get the list of enabled plugin repo names from the pi-config memory store.
 */
export function getEnabledPlugins(cwd: string): string[] {
  const raw = readKey(cwd, MEMORY_DOMAIN, MEMORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.enabled) ? parsed.enabled : [];
  } catch {
    return [];
  }
}

/**
 * Set the list of enabled plugin repo names in the pi-config memory store.
 */
export function setEnabledPlugins(cwd: string, enabled: string[]): void {
  writeKey(cwd, MEMORY_DOMAIN, MEMORY_KEY, JSON.stringify({ enabled }));
}
