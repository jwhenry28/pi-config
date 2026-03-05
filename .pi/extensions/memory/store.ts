import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// --- Types ---

export interface MemoryMetadata {
  created: string;
  last_updated: string;
  last_visited: string;
}

export interface MemoryFile {
  metadata: MemoryMetadata;
  entries: Record<string, string>; // key -> base64-encoded value
}

// --- Path helpers ---

export function memoryDir(cwd: string): string {
  return join(cwd, ".pi-memory");
}

export function storePath(cwd: string, store: string): string {
  return join(memoryDir(cwd), `${store}.json`);
}

// --- Validation ---

const STORE_RE = /^[a-zA-Z0-9_-]+$/;

export function validateStore(store: string): string | null {
  if (!STORE_RE.test(store)) return "Store name must match [a-zA-Z0-9_-]+";
  return null;
}

export function validateKey(key: string): string | null {
  if (key === "metadata") return '"metadata" is a reserved key';
  if (key.length === 0) return "Key cannot be empty";
  return null;
}

// --- Low-level read/write ---

function now(): string {
  return new Date().toISOString();
}

export function readStore(cwd: string, store: string): MemoryFile | null {
  const p = storePath(cwd, store);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as MemoryFile;
}

export function writeStore(cwd: string, store: string, data: MemoryFile): void {
  const dir = memoryDir(cwd);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(storePath(cwd, store), JSON.stringify(data, null, 2), "utf-8");
}

// --- Listing ---

export function listStoreNames(cwd: string): string[] {
  const dir = memoryDir(cwd);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

// --- High-level operations ---

export function ensureStore(cwd: string, store: string): void {
  if (readStore(cwd, store)) return;
  const ts = now();
  writeStore(cwd, store, {
    metadata: { created: ts, last_updated: ts, last_visited: ts },
    entries: {},
  });
}

export function createStore(cwd: string, store: string): string {
  const err = validateStore(store);
  if (err) return `Error: ${err}`;
  if (readStore(cwd, store)) return `Error: Store "${store}" already exists`;
  const ts = now();
  writeStore(cwd, store, {
    metadata: { created: ts, last_updated: ts, last_visited: ts },
    entries: {},
  });
  return `Created store "${store}"`;
}

export function addEntry(cwd: string, store: string, key: string, value: string): string {
  const storeErr = validateStore(store);
  if (storeErr) return `Error: ${storeErr}`;
  const keyErr = validateKey(key);
  if (keyErr) return `Error: ${keyErr}`;
  const data = readStore(cwd, store);
  if (!data) return `Error: Store "${store}" does not exist`;
  data.entries[key] = Buffer.from(value).toString("base64");
  data.metadata.last_updated = now();
  writeStore(cwd, store, data);
  return `Added key "${key}" to store "${store}"`;
}

export function getEntry(cwd: string, store: string, key: string): string {
  const storeErr = validateStore(store);
  if (storeErr) return `Error: ${storeErr}`;
  const data = readStore(cwd, store);
  if (!data) return `Error: Store "${store}" does not exist`;
  const encoded = data.entries[key];
  if (encoded === undefined) return `Error: Key "${key}" not found in store "${store}"`;
  data.metadata.last_visited = now();
  writeStore(cwd, store, data);
  return Buffer.from(encoded, "base64").toString("utf-8");
}

export function listKeys(cwd: string, store: string): string {
  const storeErr = validateStore(store);
  if (storeErr) return `Error: ${storeErr}`;
  const data = readStore(cwd, store);
  if (!data) return `Error: Store "${store}" does not exist`;
  const keys = Object.keys(data.entries);
  if (keys.length === 0) return `Store "${store}" has no entries`;
  return keys.join("\n");
}

/**
 * Read a single key from a store, returning the decoded value or null.
 * Does not update last_visited. Creates the store if it doesn't exist.
 */
export function readKey(cwd: string, store: string, key: string): string | null {
  const data = readStore(cwd, store);
  if (!data) return null;
  const encoded = data.entries[key];
  if (encoded === undefined) return null;
  return Buffer.from(encoded, "base64").toString("utf-8");
}

/**
 * Write a single key to a store, creating the store if needed.
 */
export function writeKey(cwd: string, store: string, key: string, value: string): void {
  ensureStore(cwd, store);
  const data = readStore(cwd, store)!;
  data.entries[key] = Buffer.from(value).toString("base64");
  data.metadata.last_updated = now();
  writeStore(cwd, store, data);
}

export function deleteEntry(cwd: string, store: string, key: string): string {
  const storeErr = validateStore(store);
  if (storeErr) return `Error: ${storeErr}`;
  const keyErr = validateKey(key);
  if (keyErr) return `Error: ${keyErr}`;
  const data = readStore(cwd, store);
  if (!data) return `Error: Store "${store}" does not exist`;
  if (data.entries[key] === undefined) return `Error: Key "${key}" not found in store "${store}"`;
  delete data.entries[key];
  data.metadata.last_updated = now();
  writeStore(cwd, store, data);
  return `Deleted key "${key}" from store "${store}"`;
}
