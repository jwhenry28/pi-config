import { existsSync, unlinkSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import {
  memoryDir,
  storePath,
  validateStore,
  readStore,
  listStoreNames,
  createStore,
  addEntry,
  getEntry,
  listKeys,
  deleteEntry,
} from "./store.js";

// --- Extension ---

export default function (pi: ExtensionAPI) {
  // --- Tools ---

  pi.registerTool({
    name: "memory_create",
    label: "Memory Create",
    description: "Create a new memory store. Store names must match [a-zA-Z0-9_-]+.",
    parameters: Type.Object({
      store: Type.String({ description: "Store identifier" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = createStore(ctx.cwd, params.store);
      return { content: [{ type: "text", text: result }], details: {} };
    },
  });

  pi.registerTool({
    name: "memory_add",
    label: "Memory Add",
    description:
      'Add a key-value pair to a memory store. Key cannot be "metadata". Value is stored base64-encoded internally.',
    parameters: Type.Object({
      store: Type.String({ description: "Store identifier" }),
      key: Type.String({ description: "Memory key" }),
      value: Type.String({ description: "Memory value" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = addEntry(ctx.cwd, params.store, params.key, params.value);
      return { content: [{ type: "text", text: result }], details: {} };
    },
  });

  pi.registerTool({
    name: "memory_get",
    label: "Memory Get",
    description: "Retrieve a value by key from a memory store.",
    parameters: Type.Object({
      store: Type.String({ description: "Store identifier" }),
      key: Type.String({ description: "Memory key" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = getEntry(ctx.cwd, params.store, params.key);
      return { content: [{ type: "text", text: result }], details: {} };
    },
  });

  pi.registerTool({
    name: "memory_list",
    label: "Memory List",
    description: "List all keys in a memory store. If store is omitted, lists all available stores.",
    parameters: Type.Object({
      store: Type.Optional(Type.String({ description: "Store identifier (optional — omit to list all stores)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!params.store) {
        const names = listStoreNames(ctx.cwd);
        if (names.length === 0) return { content: [{ type: "text", text: "No memory stores exist" }], details: {} };
        return { content: [{ type: "text", text: names.join("\n") }], details: {} };
      }
      const result = listKeys(ctx.cwd, params.store);
      return { content: [{ type: "text", text: result }], details: {} };
    },
  });

  pi.registerTool({
    name: "memory_delete",
    label: "Memory Delete",
    description: "Delete a key from a memory store.",
    parameters: Type.Object({
      store: Type.String({ description: "Store identifier" }),
      key: Type.String({ description: "Memory key" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = deleteEntry(ctx.cwd, params.store, params.key);
      return { content: [{ type: "text", text: result }], details: {} };
    },
  });

  // --- Command ---

  pi.registerCommand("memory", {
    description: "Manage memory stores: create, set, get, list, purge, stats",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      const subcommands = ["create", "set", "get", "list", "purge", "stats", "delete", "help"];
      const parts = prefix.split(/\s+/);
      const cwd = process.cwd();

      // Typing first word (subcommand)
      if (parts.length <= 1) {
        const typed = parts[0] || "";
        const items = subcommands
          .filter((s) => s.startsWith(typed))
          .map((s) => ({ value: s, label: s }));
        return items.length > 0 ? items : null;
      }

      const sub = parts[0];
      // Typing second word (store name)
      if (parts.length === 2) {
        const typed = parts[1];
        const names = listStoreNames(cwd);
        const items = names
          .filter((n) => n.startsWith(typed))
          .map((n) => ({ value: `${sub} ${n}`, label: n }));
        return items.length > 0 ? items : null;
      }

      // Typing third word (key) — only for get, set, delete
      if (parts.length === 3 && ["get", "set", "delete"].includes(sub)) {
        const storeName = parts[1];
        const typed = parts[2];
        const data = readStore(cwd, storeName);
        if (!data) return null;
        const keys = Object.keys(data.entries);
        const items = keys
          .filter((k) => k.startsWith(typed))
          .map((k) => ({ value: `${sub} ${storeName} ${k}`, label: k }));
        return items.length > 0 ? items : null;
      }

      return null;
    },
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0];

      if (!subcommand || subcommand === "help") {
        ctx.ui.notify(
          [
            "Usage: /memory <subcommand> [args...]",
            "",
            "  create <store>              Create a new memory store",
            "  set <store> <key> <value>   Set a key-value pair in a store",
            "  get <store> <key>           Retrieve a value by key",
            "  list [store]                List all stores, or keys in a store",
            "  purge <store|all>           Delete a store or all stores (with confirmation)",
            "  stats <store>               Show store metadata and size",
            "  delete <store> <key>        Delete a key from a store",
            "  help                        Show this help message",
            "",
            "Store names must match [a-zA-Z0-9_-]+.",
            'Key "metadata" is reserved and cannot be used.',
          ].join("\n"),
          "info",
        );
        return;
      }

      switch (subcommand) {
        case "create": {
          const store = parts[1];
          if (!store) { ctx.ui.notify("Usage: /memory create <store>", "warning"); return; }
          ctx.ui.notify(createStore(ctx.cwd, store), "info");
          break;
        }
        case "set": {
          const store = parts[1];
          const key = parts[2];
          const value = parts.slice(3).join(" ");
          if (!store || !key || !value) { ctx.ui.notify("Usage: /memory set <store> <key> <value>", "warning"); return; }
          ctx.ui.notify(addEntry(ctx.cwd, store, key, value), "info");
          break;
        }
        case "get": {
          const store = parts[1];
          const key = parts[2];
          if (!store || !key) { ctx.ui.notify("Usage: /memory get <store> <key>", "warning"); return; }
          const result = getEntry(ctx.cwd, store, key);
          ctx.ui.notify(result, result.startsWith("Error") ? "error" : "info");
          break;
        }
        case "list": {
          const store = parts[1];
          if (!store) {
            const names = listStoreNames(ctx.cwd);
            if (names.length === 0) { ctx.ui.notify("No memory stores exist", "info"); return; }
            ctx.ui.notify(names.join("\n"), "info");
            return;
          }
          const result = listKeys(ctx.cwd, store);
          ctx.ui.notify(result, result.startsWith("Error") ? "error" : "info");
          break;
        }
        case "purge": {
          const store = parts[1];
          if (!store) { ctx.ui.notify("Usage: /memory purge <store|all>", "warning"); return; }
          if (store === "all") {
            const dir = memoryDir(ctx.cwd);
            if (!existsSync(dir)) { ctx.ui.notify("No memory stores exist", "info"); return; }
            const files = readdirSync(dir).filter(f => f.endsWith(".json"));
            if (files.length === 0) { ctx.ui.notify("No memory stores exist", "info"); return; }
            const confirmed = await ctx.ui.confirm(`Delete ALL ${files.length} store(s)?`, "This will permanently delete all memories in every store.");
            if (!confirmed) { ctx.ui.notify("Cancelled", "info"); return; }
            for (const f of files) unlinkSync(join(dir, f));
            ctx.ui.notify(`Purged ${files.length} store(s)`, "info");
          } else {
            const storeErr = validateStore(store);
            if (storeErr) { ctx.ui.notify(`Error: ${storeErr}`, "error"); return; }
            if (!readStore(ctx.cwd, store)) { ctx.ui.notify(`Error: Store "${store}" does not exist`, "error"); return; }
            const confirmed = await ctx.ui.confirm(`Delete store "${store}"?`, "This will permanently delete all memories in this store.");
            if (!confirmed) { ctx.ui.notify("Cancelled", "info"); return; }
            unlinkSync(storePath(ctx.cwd, store));
            ctx.ui.notify(`Purged store "${store}"`, "info");
          }
          break;
        }
        case "stats": {
          const store = parts[1];
          if (!store) { ctx.ui.notify("Usage: /memory stats <store>", "warning"); return; }
          const storeErr = validateStore(store);
          if (storeErr) { ctx.ui.notify(`Error: ${storeErr}`, "error"); return; }
          const p = storePath(ctx.cwd, store);
          if (!existsSync(p)) { ctx.ui.notify(`Error: Store "${store}" does not exist`, "error"); return; }
          const data = readStore(ctx.cwd, store)!;
          const keyCount = Object.keys(data.entries).length;
          const fileSize = statSync(p).size;
          const lines = [
            `Store: ${store}`,
            `Keys: ${keyCount}`,
            `Size: ${fileSize} bytes`,
            `Created: ${data.metadata.created}`,
            `Last updated: ${data.metadata.last_updated}`,
            `Last visited: ${data.metadata.last_visited}`,
          ];
          ctx.ui.notify(lines.join("\n"), "info");
          break;
        }
        case "delete": {
          const store = parts[1];
          const key = parts[2];
          if (!store || !key) { ctx.ui.notify("Usage: /memory delete <store> <key>", "warning"); return; }
          const result = deleteEntry(ctx.cwd, store, key);
          ctx.ui.notify(result, result.startsWith("Error") ? "error" : "info");
          break;
        }
        default:
          ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use create, set, get, list, purge, stats, or delete.`, "warning");
      }
    },
  });
}
