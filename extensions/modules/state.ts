import { readKey, writeKey } from "../memory/store.js";
import { UNTAGGED_MODULE } from "./api.js";
import type { ModuleContents } from "./registry.js";

// --- Types ---

export interface ModuleState {
  shown: string[];
  granular: Record<string, unknown>; // Reserved for future per-item loading
}

// --- Constants ---

const MEMORY_DOMAIN = "pi-config";
const MEMORY_KEY = "pi-modules";

// --- Public API ---

/**
 * Load the current module state from memory.
 * Returns default state (nothing shown) if no state exists.
 * Handles migration from old "loaded" format to new "shown" format.
 */
export function loadState(cwd: string): ModuleState {
  const raw = readKey(cwd, MEMORY_DOMAIN, MEMORY_KEY);
  if (!raw) return { shown: [], granular: {} };
  try {
    const parsed = JSON.parse(raw) as any;
    // Migrate old "loaded" format to new "shown" format
    if (parsed.loaded !== undefined && parsed.shown === undefined) {
      return { shown: parsed.loaded, granular: parsed.granular ?? {} };
    }
    return parsed as ModuleState;
  } catch {
    return { shown: [], granular: {} };
  }
}

/**
 * Save module state to memory.
 */
export function saveState(cwd: string, state: ModuleState): void {
  writeKey(cwd, MEMORY_DOMAIN, MEMORY_KEY, JSON.stringify(state));
}

/**
 * Normalize a user-controlled list of shown modules.
 */
export function normalizeUserShownModules(
  names: string[],
  modules: Map<string, ModuleContents>,
): string[] {
  return names.filter((name) => name !== UNTAGGED_MODULE && modules.has(name));
}

/**
 * Compute which tool names should be active given the current module state.
 *
 * Rules:
 * - Tools NOT assigned to any module are always included.
 * - Tools assigned to a shown module are included.
 * - Tools assigned to a hidden module are excluded.
 */
export function computeActiveTools(
  allToolNames: string[],
  modules: Map<string, ModuleContents>,
  state: ModuleState,
): string[] {
  const excludedTools = new Set<string>();
  const shownModules = normalizeUserShownModules(state.shown ?? [], modules);
  for (const [moduleName, contents] of modules) {
    if (shownModules.includes(moduleName)) continue;
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
 * - Skills assigned to a shown module are included.
 * - Skills assigned to a hidden module are excluded.
 *
 * Returns the set of skill names that should be excluded.
 */
export function computeExcludedSkillNames(
  modules: Map<string, ModuleContents>,
  state: ModuleState,
): Set<string> {
  const excluded = new Set<string>();
  const shownModules = normalizeUserShownModules(state.shown ?? [], modules);
  for (const [moduleName, contents] of modules) {
    if (shownModules.includes(moduleName)) continue;
    for (const skill of contents.skills) {
      excluded.add(skill.name);
    }
  }
  return excluded;
}
