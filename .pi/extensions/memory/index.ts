import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// --- Types ---

interface MemoryMetadata {
  created: string;
  last_updated: string;
  last_visited: string;
}

interface MemoryFile {
  metadata: MemoryMetadata;
  entries: Record<string, string>; // key -> base64-encoded value
}

// --- Helpers ---

const DOMAIN_RE = /^[a-zA-Z0-9_-]+$/;

function validateDomain(domain: string): string | null {
  if (!DOMAIN_RE.test(domain)) return "Domain must match [a-zA-Z0-9_-]+";
  return null;
}

function validateKey(key: string): string | null {
  if (key === "metadata") return '"metadata" is a reserved key';
  if (key.length === 0) return "Key cannot be empty";
  return null;
}

function memoryDir(cwd: string): string {
  return join(cwd, ".pi-memory");
}

function domainPath(cwd: string, domain: string): string {
  return join(memoryDir(cwd), `${domain}.json`);
}

function now(): string {
  return new Date().toISOString();
}

function readDomain(cwd: string, domain: string): MemoryFile | null {
  const p = domainPath(cwd, domain);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as MemoryFile;
}

function writeDomain(cwd: string, domain: string, data: MemoryFile): void {
  const dir = memoryDir(cwd);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(domainPath(cwd, domain), JSON.stringify(data, null, 2), "utf-8");
}

// --- Core operations ---

function memoryCreate(cwd: string, domain: string): string {
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

function memoryAdd(cwd: string, domain: string, key: string, value: string): string {
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

function memoryGet(cwd: string, domain: string, key: string): string {
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

function memoryList(cwd: string, domain: string): string {
  const domErr = validateDomain(domain);
  if (domErr) return `Error: ${domErr}`;
  const data = readDomain(cwd, domain);
  if (!data) return `Error: Domain "${domain}" does not exist`;
  const keys = Object.keys(data.entries);
  if (keys.length === 0) return `Domain "${domain}" has no entries`;
  return keys.join("\n");
}

// --- Extension ---

export default function (pi: ExtensionAPI) {
  // --- Tools ---

  pi.registerTool({
    name: "memory_create",
    label: "Memory Create",
    description: "Create a new memory domain. Domain names must match [a-zA-Z0-9_-]+.",
    parameters: Type.Object({
      domain: Type.String({ description: "Domain identifier" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = memoryCreate(ctx.cwd, params.domain);
      return { content: [{ type: "text", text: result }], details: {} };
    },
  });

  pi.registerTool({
    name: "memory_add",
    label: "Memory Add",
    description:
      'Add a key-value pair to a memory domain. Key cannot be "metadata". Value is stored base64-encoded internally.',
    parameters: Type.Object({
      domain: Type.String({ description: "Domain identifier" }),
      key: Type.String({ description: "Memory key" }),
      value: Type.String({ description: "Memory value" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = memoryAdd(ctx.cwd, params.domain, params.key, params.value);
      return { content: [{ type: "text", text: result }], details: {} };
    },
  });

  pi.registerTool({
    name: "memory_get",
    label: "Memory Get",
    description: "Retrieve a value by key from a memory domain.",
    parameters: Type.Object({
      domain: Type.String({ description: "Domain identifier" }),
      key: Type.String({ description: "Memory key" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = memoryGet(ctx.cwd, params.domain, params.key);
      return { content: [{ type: "text", text: result }], details: {} };
    },
  });

  pi.registerTool({
    name: "memory_list",
    label: "Memory List",
    description: "List all keys in a memory domain.",
    parameters: Type.Object({
      domain: Type.String({ description: "Domain identifier" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = memoryList(ctx.cwd, params.domain);
      return { content: [{ type: "text", text: result }], details: {} };
    },
  });

  // --- Command ---

  pi.registerCommand("memory", {
    description: "Manage memory domains: create, add, get, list, purge, stats",
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0];

      if (!subcommand || subcommand === "help") {
        ctx.ui.notify(
          [
            "Usage: /memory <subcommand> [args...]",
            "",
            "  create <domain>              Create a new memory domain",
            "  add <domain> <key> <value>   Add a key-value pair to a domain",
            "  get <domain> <key>           Retrieve a value by key",
            "  list <domain>                List all keys in a domain",
            "  purge <domain|all>           Delete a domain or all domains (with confirmation)",
            "  stats <domain>               Show domain metadata and size",
            "  help                         Show this help message",
            "",
            "Domain names must match [a-zA-Z0-9_-]+.",
            'Key "metadata" is reserved and cannot be used.',
          ].join("\n"),
          "info",
        );
        return;
      }

      switch (subcommand) {
        case "create": {
          const domain = parts[1];
          if (!domain) { ctx.ui.notify("Usage: /memory create <domain>", "warning"); return; }
          ctx.ui.notify(memoryCreate(ctx.cwd, domain), "info");
          break;
        }
        case "add": {
          const domain = parts[1];
          const key = parts[2];
          const value = parts.slice(3).join(" ");
          if (!domain || !key || !value) { ctx.ui.notify("Usage: /memory add <domain> <key> <value>", "warning"); return; }
          ctx.ui.notify(memoryAdd(ctx.cwd, domain, key, value), "info");
          break;
        }
        case "get": {
          const domain = parts[1];
          const key = parts[2];
          if (!domain || !key) { ctx.ui.notify("Usage: /memory get <domain> <key>", "warning"); return; }
          const result = memoryGet(ctx.cwd, domain, key);
          ctx.ui.notify(result, result.startsWith("Error") ? "error" : "info");
          break;
        }
        case "list": {
          const domain = parts[1];
          if (!domain) { ctx.ui.notify("Usage: /memory list <domain>", "warning"); return; }
          const result = memoryList(ctx.cwd, domain);
          ctx.ui.notify(result, result.startsWith("Error") ? "error" : "info");
          break;
        }
        case "purge": {
          const domain = parts[1];
          if (!domain) { ctx.ui.notify("Usage: /memory purge <domain|all>", "warning"); return; }
          if (domain === "all") {
            const dir = memoryDir(ctx.cwd);
            if (!existsSync(dir)) { ctx.ui.notify("No memory domains exist", "info"); return; }
            const files = readdirSync(dir).filter(f => f.endsWith(".json"));
            if (files.length === 0) { ctx.ui.notify("No memory domains exist", "info"); return; }
            const confirmed = await ctx.ui.confirm(`Delete ALL ${files.length} domain(s)?`, "This will permanently delete all memories in every domain.");
            if (!confirmed) { ctx.ui.notify("Cancelled", "info"); return; }
            for (const f of files) unlinkSync(join(dir, f));
            ctx.ui.notify(`Purged ${files.length} domain(s)`, "info");
          } else {
            const domErr = validateDomain(domain);
            if (domErr) { ctx.ui.notify(`Error: ${domErr}`, "error"); return; }
            if (!readDomain(ctx.cwd, domain)) { ctx.ui.notify(`Error: Domain "${domain}" does not exist`, "error"); return; }
            const confirmed = await ctx.ui.confirm(`Delete domain "${domain}"?`, "This will permanently delete all memories in this domain.");
            if (!confirmed) { ctx.ui.notify("Cancelled", "info"); return; }
            unlinkSync(domainPath(ctx.cwd, domain));
            ctx.ui.notify(`Purged domain "${domain}"`, "info");
          }
          break;
        }
        case "stats": {
          const domain = parts[1];
          if (!domain) { ctx.ui.notify("Usage: /memory stats <domain>", "warning"); return; }
          const domErr = validateDomain(domain);
          if (domErr) { ctx.ui.notify(`Error: ${domErr}`, "error"); return; }
          const p = domainPath(ctx.cwd, domain);
          if (!existsSync(p)) { ctx.ui.notify(`Error: Domain "${domain}" does not exist`, "error"); return; }
          const data = readDomain(ctx.cwd, domain)!;
          const keyCount = Object.keys(data.entries).length;
          const fileSize = statSync(p).size;
          const lines = [
            `Domain: ${domain}`,
            `Keys: ${keyCount}`,
            `Size: ${fileSize} bytes`,
            `Created: ${data.metadata.created}`,
            `Last updated: ${data.metadata.last_updated}`,
            `Last visited: ${data.metadata.last_visited}`,
          ];
          ctx.ui.notify(lines.join("\n"), "info");
          break;
        }
        default:
          ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use create, add, get, list, purge, or stats.`, "warning");
      }
    },
  });
}
