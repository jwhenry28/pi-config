import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

export function domainPath(cwd: string, domain: string): string {
  return join(memoryDir(cwd), `${domain}.json`);
}

// --- Validation ---

const DOMAIN_RE = /^[a-zA-Z0-9_-]+$/;

export function validateDomain(domain: string): string | null {
  if (!DOMAIN_RE.test(domain)) return "Domain must match [a-zA-Z0-9_-]+";
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

export function readDomain(cwd: string, domain: string): MemoryFile | null {
  const p = domainPath(cwd, domain);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as MemoryFile;
}

export function writeDomain(cwd: string, domain: string, data: MemoryFile): void {
  const dir = memoryDir(cwd);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(domainPath(cwd, domain), JSON.stringify(data, null, 2), "utf-8");
}

// --- High-level operations ---

export function ensureDomain(cwd: string, domain: string): void {
  if (readDomain(cwd, domain)) return;
  const ts = now();
  writeDomain(cwd, domain, {
    metadata: { created: ts, last_updated: ts, last_visited: ts },
    entries: {},
  });
}

export function createDomain(cwd: string, domain: string): string {
  const err = validateDomain(domain);
  if (err) return `Error: ${err}`;
  if (readDomain(cwd, domain)) return `Error: Domain "${domain}" already exists`;
  const ts = now();
  writeDomain(cwd, domain, {
    metadata: { created: ts, last_updated: ts, last_visited: ts },
    entries: {},
  });
  return `Created domain "${domain}"`;
}

export function addEntry(cwd: string, domain: string, key: string, value: string): string {
  const domErr = validateDomain(domain);
  if (domErr) return `Error: ${domErr}`;
  const keyErr = validateKey(key);
  if (keyErr) return `Error: ${keyErr}`;
  const data = readDomain(cwd, domain);
  if (!data) return `Error: Domain "${domain}" does not exist`;
  data.entries[key] = Buffer.from(value).toString("base64");
  data.metadata.last_updated = now();
  writeDomain(cwd, domain, data);
  return `Added key "${key}" to domain "${domain}"`;
}

export function getEntry(cwd: string, domain: string, key: string): string {
  const domErr = validateDomain(domain);
  if (domErr) return `Error: ${domErr}`;
  const data = readDomain(cwd, domain);
  if (!data) return `Error: Domain "${domain}" does not exist`;
  const encoded = data.entries[key];
  if (encoded === undefined) return `Error: Key "${key}" not found in domain "${domain}"`;
  data.metadata.last_visited = now();
  writeDomain(cwd, domain, data);
  return Buffer.from(encoded, "base64").toString("utf-8");
}

export function listKeys(cwd: string, domain: string): string {
  const domErr = validateDomain(domain);
  if (domErr) return `Error: ${domErr}`;
  const data = readDomain(cwd, domain);
  if (!data) return `Error: Domain "${domain}" does not exist`;
  const keys = Object.keys(data.entries);
  if (keys.length === 0) return `Domain "${domain}" has no entries`;
  return keys.join("\n");
}

/**
 * Read a single key from a domain, returning the decoded value or null.
 * Does not update last_visited. Creates the domain if it doesn't exist.
 */
export function readKey(cwd: string, domain: string, key: string): string | null {
  const data = readDomain(cwd, domain);
  if (!data) return null;
  const encoded = data.entries[key];
  if (encoded === undefined) return null;
  return Buffer.from(encoded, "base64").toString("utf-8");
}

/**
 * Write a single key to a domain, creating the domain if needed.
 */
export function writeKey(cwd: string, domain: string, key: string, value: string): void {
  ensureDomain(cwd, domain);
  const data = readDomain(cwd, domain)!;
  data.entries[key] = Buffer.from(value).toString("base64");
  data.metadata.last_updated = now();
  writeDomain(cwd, domain, data);
}

export function deleteEntry(cwd: string, domain: string, key: string): string {
  const domErr = validateDomain(domain);
  if (domErr) return `Error: ${domErr}`;
  const keyErr = validateKey(key);
  if (keyErr) return `Error: ${keyErr}`;
  const data = readDomain(cwd, domain);
  if (!data) return `Error: Domain "${domain}" does not exist`;
  if (data.entries[key] === undefined) return `Error: Key "${key}" not found in domain "${domain}"`;
  delete data.entries[key];
  data.metadata.last_updated = now();
  writeDomain(cwd, domain, data);
  return `Deleted key "${key}" from domain "${domain}"`;
}
