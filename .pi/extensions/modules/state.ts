import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ModuleContents } from "./registry.js";

// --- Types ---

export interface ModuleState {
  loaded: string[];
  granular: Record<string, unknown>; // Reserved for future per-item loading
}

// --- Constants ---

const MEMORY_DOMAIN = "pi-config";
const MEMORY_KEY = "pi-modules";

const EXEMPT_TOOLS = new Set([
  // Built-in tools
  "read", "bash", "edit", "write", "grep", "find", "ls",
  // Memory tools
  "memory_create", "memory_add", "memory_get", "memory_list",
]);

// --- Memory helpers (direct filesystem access) ---

function memoryDir(cwd: string): string {
  return join(cwd, ".pi-memory");
}

function domainPath(cwd: string): string {
  return join(memoryDir(cwd), `${MEMORY_DOMAIN}.json`);
}

interface MemoryFile {
  metadata: { created: string; last_updated: string; last_visited: string };
  entries: Record<string, string>;
}

function ensureDomain(cwd: string): void {
  const dir = memoryDir(cwd);
  const filePath = domainPath(cwd);
  if (existsSync(filePath)) return;

  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString();
  writeFileSync(filePath, JSON.stringify({
    metadata: { created: ts, last_updated: ts, last_visited: ts },
    entries: {},
  }, null, 2), "utf-8");
}

function readMemoryKey(cwd: string): ModuleState | null {
  const filePath = domainPath(cwd);
  if (!existsSync(filePath)) return null;

  try {
    const data = JSON.parse(readFileSync(filePath, "utf-8")) as MemoryFile;
    const encoded = data.entries[MEMORY_KEY];
    if (!encoded) return null;
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) as ModuleState;
  } catch {
    return null;
  }
}

function writeMemoryKey(cwd: string, state: ModuleState): void {
  ensureDomain(cwd);
  const filePath = domainPath(cwd);
  const data = JSON.parse(readFileSync(filePath, "utf-8")) as MemoryFile;
  data.entries[MEMORY_KEY] = Buffer.from(JSON.stringify(state)).toString("base64");
  data.metadata.last_updated = new Date().toISOString();
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// --- Public API ---

/**
 * Load the current module state from memory.
 * Returns default state (nothing loaded) if no state exists.
 */
export function loadState(cwd: string): ModuleState {
  return readMemoryKey(cwd) ?? { loaded: [], granular: {} };
}

/**
 * Save module state to memory.
 */
export function saveState(cwd: string, state: ModuleState): void {
  writeMemoryKey(cwd, state);
}

/**
 * Compute which tool names should be active given the current module state.
 *
 * Rules:
 * - Exempt tools (built-in, memory) are always included.
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
    const isLoaded = state.loaded.includes(moduleName);
    if (isLoaded) continue;

    for (const toolName of contents.tools) {
      excludedTools.add(toolName);
    }
  }

  return allToolNames.filter(name => {
    if (EXEMPT_TOOLS.has(name)) return true;
    if (excludedTools.has(name)) return false;
    return true;
  });
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
    const isLoaded = state.loaded.includes(moduleName);
    if (isLoaded) continue;

    for (const skill of contents.skills) {
      excluded.add(skill.name);
    }
  }
  return excluded;
}
