import { randomBytes } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { storePath } from "../memory/store.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// No-op extension so pi doesn't error when scanning this folder.
export default function testutilsExtension(_pi: ExtensionAPI) {}

// ── Mock ExtensionAPI ──────────────────────────────────────────────

/**
 * Generate a unique store name for test isolation.
 * @param prefix - A prefix identifying the extension under test, e.g. "test-todo-"
 */
export function makeStoreName(prefix: string = "test-"): string {
  return prefix + randomBytes(6).toString("hex");
}

/**
 * Delete a memory store file if it exists.
 */
export function purgeStore(cwd: string, store: string): void {
  const p = storePath(cwd, store);
  if (existsSync(p)) unlinkSync(p);
}

export interface MockTexOptions {
  confirm?: (title: string, msg: string) => Promise<boolean>;
}

/**
 * Minimal execution context with `cwd`, `storeName`, and a mock `ui`.
 * Compatible with any extension's `*ExecutionContext` type that follows
 * the `{ cwd, storeName, ui }` pattern.
 */
export function makeMockTex(cwd: string, storeName: string, options: MockTexOptions = {}) {
  const notifications: Array<{ msg: string; level: string }> = [];
  const tex = {
    cwd,
    storeName,
    ui: {
      notify: (msg: string, level: string) => {
        notifications.push({ msg, level });
      },
      confirm: options.confirm ?? (async () => false),
    },
  };
  return { tex, notifications };
}

// ── Mock ExtensionAPI ──────────────────────────────────────────────

export interface MockPiMessages {
  sent: Array<Record<string, unknown>>;
  userMessages: string[];
}

/**
 * Create a minimal mock of `ExtensionAPI` that captures `sendMessage`
 * and `sendUserMessage` calls. All other methods are no-op stubs.
 */
export function makeMockPi(): { pi: ExtensionAPI; messages: MockPiMessages } {
  const messages: MockPiMessages = { sent: [], userMessages: [] };
  const pi = {
    sendMessage: (msg: Record<string, unknown>) => {
      messages.sent.push(msg);
    },
    sendUserMessage: (msg: string) => {
      messages.userMessages.push(msg);
    },
    // Stubs for fields we don't exercise in unit tests
    registerCommand: () => {},
    registerTool: () => {},
    on: () => ({ dispose: () => {} }),
  } as unknown as ExtensionAPI;
  return { pi, messages };
}
