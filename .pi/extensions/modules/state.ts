import { readKey, writeKey } from "../memory/store.js";
import type { ModuleContents } from "./registry.js";

// --- Types ---

export interface ModuleState {
  loaded: string[];
  granular: Record<string, unknown>; // Reserved for future per-item loading
}

// --- Constants ---

const MEMORY_DOMAIN = "pi-config";
const MEMORY_KEY = "pi-modules";

// --- Public API ---

/**
 * Load the current module state from memory.
 * Returns default state (nothing loaded) if no state exists.
 */
export function loadState(cwd: string): ModuleState {
  const raw = readKey(cwd, MEMORY_DOMAIN, MEMORY_KEY);
  if (!raw) return { loaded: [], granular: {} };
  try {
    return JSON.parse(raw) as ModuleState;
  } catch {
    return { loaded: [], granular: {} };
  }
}

/**
 * Save module state to memory.
 */
export function saveState(cwd: string, state: ModuleState): void {
  writeKey(cwd, MEMORY_DOMAIN, MEMORY_KEY, JSON.stringify(state));
}

/**
 * Compute which tool names should be active given the current module state.
 *
 * Rules:
 * - Tools NOT assigned to any module are always included.
 * - Tools assigned to a loaded module are included.
 * - Tools assigned to an unloaded module are excluded.
 */
export function computeActiveTools(
  allToolNames: string[],
  modules: Map<string, ModuleContents>,
  state: ModuleState,
): string[] {
  // Build a set of tool names belonging to unloaded modules
  const excludedTools = new Set<string>();
  for (const [moduleName, contents] of modules) {
    if (state.loaded.includes(moduleName)) continue;
    for (const toolName of contents.tools) {
      excludedTools.add(toolName);
    }
  }

  return allToolNames.filter(name => !excludedTools.has(name));
}

/**
 * Compute which skill names should be EXCLUDED from the system prompt.
 *
 * Rules:
 * - Skills NOT assigned to any module are always included.
 * - Skills assigned to a loaded module are included.
 * - Skills assigned to an unloaded module are excluded.
 *
 * Returns the set of skill names that should be excluded.
 */
export function computeExcludedSkillNames(
  modules: Map<string, ModuleContents>,
  state: ModuleState,
): Set<string> {
  const excluded = new Set<string>();
  for (const [moduleName, contents] of modules) {
    if (state.loaded.includes(moduleName)) continue;
    for (const skill of contents.skills) {
      excluded.add(skill.name);
    }
  }
  return excluded;
}
