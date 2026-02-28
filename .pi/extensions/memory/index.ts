import { existsSync, unlinkSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  memoryDir,
  domainPath,
  validateDomain,
  readDomain,
  createDomain,
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
    description: "Create a new memory domain. Domain names must match [a-zA-Z0-9_-]+.",
    parameters: Type.Object({
      domain: Type.String({ description: "Domain identifier" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = createDomain(ctx.cwd, params.domain);
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
      const result = addEntry(ctx.cwd, params.domain, params.key, params.value);
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
      const result = getEntry(ctx.cwd, params.domain, params.key);
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
      const result = listKeys(ctx.cwd, params.domain);
      return { content: [{ type: "text", text: result }], details: {} };
    },
  });

  pi.registerTool({
    name: "memory_delete",
    label: "Memory Delete",
    description: "Delete a key from a memory domain.",
    parameters: Type.Object({
      domain: Type.String({ description: "Domain identifier" }),
      key: Type.String({ description: "Memory key" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = deleteEntry(ctx.cwd, params.domain, params.key);
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
            "  delete <domain> <key>         Delete a key from a domain",
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
          ctx.ui.notify(createDomain(ctx.cwd, domain), "info");
          break;
        }
        case "add": {
          const domain = parts[1];
          const key = parts[2];
          const value = parts.slice(3).join(" ");
          if (!domain || !key || !value) { ctx.ui.notify("Usage: /memory add <domain> <key> <value>", "warning"); return; }
          ctx.ui.notify(addEntry(ctx.cwd, domain, key, value), "info");
          break;
        }
        case "get": {
          const domain = parts[1];
          const key = parts[2];
          if (!domain || !key) { ctx.ui.notify("Usage: /memory get <domain> <key>", "warning"); return; }
          const result = getEntry(ctx.cwd, domain, key);
          ctx.ui.notify(result, result.startsWith("Error") ? "error" : "info");
          break;
        }
        case "list": {
          const domain = parts[1];
          if (!domain) { ctx.ui.notify("Usage: /memory list <domain>", "warning"); return; }
          const result = listKeys(ctx.cwd, domain);
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
        case "delete": {
          const domain = parts[1];
          const key = parts[2];
          if (!domain || !key) { ctx.ui.notify("Usage: /memory delete <domain> <key>", "warning"); return; }
          const result = deleteEntry(ctx.cwd, domain, key);
          ctx.ui.notify(result, result.startsWith("Error") ? "error" : "info");
          break;
        }
        default:
          ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use create, add, get, list, purge, stats, or delete.`, "warning");
      }
    },
  });
}
