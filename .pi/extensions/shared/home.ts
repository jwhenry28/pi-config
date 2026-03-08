/**
 * Centralized home directory resolution for extensions.
 *
 * Uses globalThis to share state across module systems (vitest vs jiti).
 * Mirrors the pattern in shared/cwd.ts.
 */

import { homedir } from "node:os";
import { join } from "node:path";

const HOME_OVERRIDE_KEY = "__pi_home_override__";

export function setHomeDirOverride(dir: string): void {
  (globalThis as any)[HOME_OVERRIDE_KEY] = dir;
}

export function clearHomeDirOverride(): void {
  delete (globalThis as any)[HOME_OVERRIDE_KEY];
}

export function getHomeDir(): string {
  const override = (globalThis as any)[HOME_OVERRIDE_KEY];
  if (override) return override;
  return homedir();
}

export function getPluginsDir(): string {
  return join(getHomeDir(), ".pi", "plugins");
}
