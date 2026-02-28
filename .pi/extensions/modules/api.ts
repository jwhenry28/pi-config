/**
 * Tool-to-module tagging API.
 *
 * Other extensions import `moduleTag` and wrap their `pi.registerTool()` calls:
 *
 *   import { moduleTag } from "../modules/api.js";
 *   pi.registerTool(moduleTag("design", { name: "design_review", ... }));
 *
 * This records the tool-name-to-module-name association without modifying the tool.
 */

// tool name → module name
const toolModuleMap = new Map<string, string>();

/**
 * Tag a tool definition with a module name.
 * Records the association internally; returns the tool definition unchanged.
 */
export function moduleTag<T extends { name: string }>(moduleName: string, toolDef: T): T {
  toolModuleMap.set(toolDef.name, moduleName);
  return toolDef;
}

/**
 * Get a read-only snapshot of all tool-to-module associations.
 * Used by registry.ts during module discovery.
 */
export function getToolModuleMap(): ReadonlyMap<string, string> {
  return toolModuleMap;
}
