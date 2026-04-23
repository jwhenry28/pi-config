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
 * Events are also buffered on the shared event bus so the modules extension can
 * replay tags that fired before its listener was registered (load-order independent).
 *
 * NOTE: A module-level Map is NOT used because each extension gets its own
 * isolated module instance (jiti loads with moduleCache: false), so a Map
 * in this file would not be shared between the modules extension and the
 * extension calling moduleTag.
 */

import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { TSchema } from "typebox";

/** Event payload emitted when a tool is tagged with a module. */
export interface ModuleToolTagEvent {
  toolName: string;
  moduleName: string;
}

/** Key used to store the replay buffer on the shared event bus. */
const REPLAY_KEY = "__module_tool_tags__";

/**
 * Tag a tool definition with a module name.
 * Emits a "module:tool-tag" event on the shared event bus and appends to
 * the replay buffer. Returns the tool definition unchanged.
 */
export function moduleTag<TParams extends TSchema, TDetails>(pi: ExtensionAPI, moduleName: string, toolDef: ToolDefinition<TParams, TDetails>): ToolDefinition<TParams, TDetails> {
  const event: ModuleToolTagEvent = { toolName: toolDef.name, moduleName };

  // Append to replay buffer (shared across extensions via the events object)
  const events = pi.events as any;
  if (!events[REPLAY_KEY]) events[REPLAY_KEY] = [];
  (events[REPLAY_KEY] as ModuleToolTagEvent[]).push(event);

  pi.events.emit("module:tool-tag", event);
  return toolDef;
}

/**
 * Drain the replay buffer of all module:tool-tag events that fired before
 * the caller's listener was registered. Safe to call multiple times — each
 * call returns only events not previously drained.
 */
export function drainToolTagBuffer(pi: ExtensionAPI): ModuleToolTagEvent[] {
  const events = pi.events as any;
  const buffer: ModuleToolTagEvent[] = events[REPLAY_KEY] ?? [];
  events[REPLAY_KEY] = [];
  return buffer;
}
