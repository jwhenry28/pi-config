/**
 * Tool-to-module tagging API.
 *
 * Other extensions call `moduleTag` with their `pi` instance to tag tools:
 *
 *   import { moduleTag } from "./modules/api.js";
 *   pi.registerTool(moduleTag(pi, "design", { name: "design_review", ... }));
 *
 * This emits a "module:tool-tag" event on the shared event bus so the modules
 * extension can discover tool-to-module associations across extension boundaries.
 *
 * NOTE: A module-level Map is NOT used because each extension gets its own
 * isolated module instance (jiti loads with moduleCache: false), so a Map
 * in this file would not be shared between the modules extension and the
 * extension calling moduleTag.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/** Event payload emitted when a tool is tagged with a module. */
export interface ModuleToolTagEvent {
  toolName: string;
  moduleName: string;
}

/**
 * Tag a tool definition with a module name.
 * Emits a "module:tool-tag" event on the shared event bus; returns the tool definition unchanged.
 */
export function moduleTag<T extends { name: string }>(pi: ExtensionAPI, moduleName: string, toolDef: T): T {
  pi.events.emit("module:tool-tag", { toolName: toolDef.name, moduleName } satisfies ModuleToolTagEvent);
  return toolDef;
}
