import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { getCwd } from "../shared/cwd.js";
import {
  addEntry,
  createStore,
  deleteEntry,
  getEntry,
  isReservedStore,
  listKeys,
  listStoreNames,
  memoryDir,
  readStore,
  storePath,
  validateStore,
} from "./store.js";

const SUBCOMMANDS = ["create", "set", "get", "list", "purge", "stats", "delete", "help"] as const;

type Subcommand = (typeof SUBCOMMANDS)[number];

interface CommandContext {
  cwd: string;
  ui: {
    notify(msg: string, level: "info" | "warning" | "error"): void;
    confirm(title: string, message?: string): Promise<boolean>;
  };
}

export default function memoryExtension(pi: ExtensionAPI) {
  let cwd = "";

  pi.on("session_start", async (_event, ctx) => {
    cwd = getCwd(ctx);
  });

  registerMemoryTools(pi);

  pi.registerCommand("memory", {
    description: "Manage memory stores: create, set, get, list, purge, stats",
    getArgumentCompletions: (prefix: string) => getMemoryCompletions(prefix, cwd),
    handler: async (args, ctx) => handleMemoryCommand(args, { ...ctx, cwd: getCwd(ctx) }),
  });
}

function registerMemoryTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "memory_create",
    label: "Memory Create",
    description: "Create a new memory store. Store names must match [a-zA-Z0-9_-]+.",
    parameters: Type.Object({
      store: Type.String({ description: "Store identifier" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return asToolResult(createStore(getCwd(ctx), params.store));
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
      return asToolResult(addEntry(getCwd(ctx), params.store, params.key, params.value));
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
      return asToolResult(getEntry(getCwd(ctx), params.store, params.key));
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
        const names = listStoreNames(getCwd(ctx));
        const text = names.length === 0 ? "No memory stores exist" : names.join("\n");
        return asToolResult(text);
      }
      return asToolResult(listKeys(getCwd(ctx), params.store));
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
      return asToolResult(deleteEntry(getCwd(ctx), params.store, params.key));
    },
  });
}

function asToolResult(text: string): { content: Array<{ type: "text"; text: string }>; details: {} } {
  return { content: [{ type: "text", text }], details: {} };
}

function parseSubcommand(args: string): { subcommand: string; parts: string[] } {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  return { subcommand: parts[0] ?? "", parts };
}

async function handleMemoryCommand(args: string, ctx: CommandContext): Promise<void> {
  const { subcommand, parts } = parseSubcommand(args);

  if (!subcommand || subcommand === "help") {
    ctx.ui.notify(getHelpText(), "info");
    return;
  }

  switch (subcommand as Subcommand) {
    case "create":
      return handleCreate(parts, ctx);
    case "set":
      return handleSet(parts, ctx);
    case "get":
      return handleGet(parts, ctx);
    case "list":
      return handleList(parts, ctx);
    case "purge":
      return handlePurge(parts, ctx);
    case "stats":
      return handleStats(parts, ctx);
    case "delete":
      return handleDelete(parts, ctx);
    default:
      ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use ${SUBCOMMANDS.join(", ")}.`, "warning");
  }
}

function handleCreate(parts: string[], ctx: CommandContext): void {
  const store = parts[1];
  if (!store) {
    ctx.ui.notify("Usage: /memory create <store>", "warning");
    return;
  }
  notifyResult(ctx, createStore(ctx.cwd, store));
}

function handleSet(parts: string[], ctx: CommandContext): void {
  const store = parts[1];
  const key = parts[2];
  const value = parts.slice(3).join(" ");
  if (!store || !key || !value) {
    ctx.ui.notify("Usage: /memory set <store> <key> <value>", "warning");
    return;
  }
  notifyResult(ctx, addEntry(ctx.cwd, store, key, value));
}

function handleGet(parts: string[], ctx: CommandContext): void {
  const store = parts[1];
  const key = parts[2];
  if (!store || !key) {
    ctx.ui.notify("Usage: /memory get <store> <key>", "warning");
    return;
  }
  notifyResult(ctx, getEntry(ctx.cwd, store, key));
}

function handleList(parts: string[], ctx: CommandContext): void {
  const store = parts[1];
  if (!store) {
    const names = listStoreNames(ctx.cwd);
    ctx.ui.notify(names.length === 0 ? "No memory stores exist" : names.join("\n"), "info");
    return;
  }
  notifyResult(ctx, listKeys(ctx.cwd, store));
}

async function handlePurge(parts: string[], ctx: CommandContext): Promise<void> {
  const target = parts[1];
  if (!target) {
    ctx.ui.notify("Usage: /memory purge <store|all>", "warning");
    return;
  }

  if (target === "all") {
    await handlePurgeAll(ctx);
    return;
  }

  await handlePurgeOne(target, ctx);
}

async function handlePurgeAll(ctx: CommandContext): Promise<void> {
  const dir = memoryDir(ctx.cwd);
  if (!existsSync(dir)) {
    ctx.ui.notify("No memory stores exist", "info");
    return;
  }

  const allFiles = readdirSync(dir).filter((f) => f.endsWith(".json"));
  if (allFiles.length === 0) {
    ctx.ui.notify("No memory stores exist", "info");
    return;
  }

  const purgeable = allFiles.filter((f) => !isReservedStore(f.replace(/\.json$/, "")));
  const skipped = allFiles.length - purgeable.length;

  if (purgeable.length === 0) {
    ctx.ui.notify("No non-reserved memory stores to purge", "info");
    return;
  }

  const confirmMsg =
    skipped > 0
      ? `This will permanently delete all memories in ${purgeable.length} store(s). ${skipped} reserved store(s) will be skipped.`
      : "This will permanently delete all memories in every store.";

  const confirmed = await ctx.ui.confirm(`Delete ${purgeable.length} store(s)?`, confirmMsg);
  if (!confirmed) {
    ctx.ui.notify("Cancelled", "info");
    return;
  }

  for (const fileName of purgeable) {
    unlinkSync(join(dir, fileName));
  }

  const result = skipped > 0
    ? `Purged ${purgeable.length} store(s) (skipped ${skipped} reserved)`
    : `Purged ${purgeable.length} store(s)`;

  ctx.ui.notify(result, "info");
}

async function handlePurgeOne(store: string, ctx: CommandContext): Promise<void> {
  const storeError = validateStore(store);
  if (storeError) {
    ctx.ui.notify(`Error: ${storeError}`, "error");
    return;
  }

  if (!readStore(ctx.cwd, store)) {
    ctx.ui.notify(`Error: Store "${store}" does not exist`, "error");
    return;
  }

  const reservedOwner = isReservedStore(store);
  if (reservedOwner) {
    ctx.ui.notify(`Error: Store "${store}" is reserved by ${reservedOwner} and cannot be purged`, "error");
    return;
  }

  const confirmed = await ctx.ui.confirm(
    `Delete store "${store}"?`,
    "This will permanently delete all memories in this store.",
  );
  if (!confirmed) {
    ctx.ui.notify("Cancelled", "info");
    return;
  }

  unlinkSync(storePath(ctx.cwd, store));
  ctx.ui.notify(`Purged store "${store}"`, "info");
}

function handleStats(parts: string[], ctx: CommandContext): void {
  const store = parts[1];
  if (!store) {
    ctx.ui.notify("Usage: /memory stats <store>", "warning");
    return;
  }

  const storeError = validateStore(store);
  if (storeError) {
    ctx.ui.notify(`Error: ${storeError}`, "error");
    return;
  }

  const path = storePath(ctx.cwd, store);
  if (!existsSync(path)) {
    ctx.ui.notify(`Error: Store "${store}" does not exist`, "error");
    return;
  }

  const data = readStore(ctx.cwd, store)!;
  const lines = [
    `Store: ${store}`,
    `Keys: ${Object.keys(data.entries).length}`,
    `Size: ${statSync(path).size} bytes`,
    `Created: ${data.metadata.created}`,
    `Last updated: ${data.metadata.last_updated}`,
    `Last visited: ${data.metadata.last_visited}`,
  ];
  ctx.ui.notify(lines.join("\n"), "info");
}

function handleDelete(parts: string[], ctx: CommandContext): void {
  const store = parts[1];
  const key = parts[2];
  if (!store || !key) {
    ctx.ui.notify("Usage: /memory delete <store> <key>", "warning");
    return;
  }
  notifyResult(ctx, deleteEntry(ctx.cwd, store, key));
}

function notifyResult(ctx: CommandContext, result: string): void {
  ctx.ui.notify(result, result.startsWith("Error") ? "error" : "info");
}

function getHelpText(): string {
  return [
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
  ].join("\n");
}

function getMemoryCompletions(prefix: string, cwd: string): AutocompleteItem[] | null {
  const hasTrailingSpace = prefix.endsWith(" ");
  const trimmed = prefix.trim();

  if (!trimmed) {
    return SUBCOMMANDS.map((value) => ({ value, label: value }));
  }

  const parts = trimmed.split(/\s+/);
  const subcommand = parts[0] ?? "";

  if (parts.length === 1 && !hasTrailingSpace) {
    const matches = SUBCOMMANDS.filter((s) => s.startsWith(subcommand));
    return matches.length > 0 ? matches.map((value) => ({ value, label: value })) : null;
  }

  if (parts.length === 1 && hasTrailingSpace) {
    const stores = listStoreNames(cwd);
    return stores.length > 0
      ? stores.map((store) => ({ value: `${subcommand} ${store}`, label: store }))
      : null;
  }

  if (parts.length === 2 && !hasTrailingSpace) {
    const storePrefix = parts[1] ?? "";
    const stores = listStoreNames(cwd)
      .filter((store) => store.startsWith(storePrefix))
      .map((store) => ({ value: `${subcommand} ${store}`, label: store }));
    return stores.length > 0 ? stores : null;
  }

  if (["get", "set", "delete"].includes(subcommand) && parts.length === 3 && !hasTrailingSpace) {
    const storeName = parts[1] ?? "";
    const keyPrefix = parts[2] ?? "";
    return completeKeys(subcommand, cwd, storeName, keyPrefix);
  }

  if (["get", "set", "delete"].includes(subcommand) && parts.length === 2 && hasTrailingSpace) {
    const storeName = parts[1] ?? "";
    return completeKeys(subcommand, cwd, storeName, "");
  }

  return null;
}

function completeKeys(subcommand: string, cwd: string, storeName: string, keyPrefix: string): AutocompleteItem[] | null {
  const data = readStore(cwd, storeName);
  if (!data) return null;
  const items = Object.keys(data.entries)
    .filter((key) => key.startsWith(keyPrefix))
    .map((key) => ({ value: `${subcommand} ${storeName} ${key}`, label: key }));
  return items.length > 0 ? items : null;
}
