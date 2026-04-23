import { Type } from "typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { moduleTag } from "../modules/api.ts";
import { createSearchProvider } from "./search/provider.js";
import type { SearchResult } from "./search/types.js";
import { webFetch, type FetchResult } from "./fetch/fetch.js";

interface SearchDetails {
  queries: string[];
  results: SearchResult[];
}

interface WebSearchParams {
  queries: string[];
  maxResults?: number;
}

interface WebFetchParams {
  url: string;
  maxLength?: number;
}

interface FetchDetails {
  result: FetchResult;
}

export default function webExtension(pi: ExtensionAPI) {
  const provider = createSearchProvider();

  pi.registerMessageRenderer("web-provider", (message, _options, theme) => {
    const details = message.details as { provider: string; hasTavily: boolean };
    if (!details) return undefined;

    const text = details.hasTavily
      ? theme.fg("dim", `web_search using ${details.provider}`)
      : theme.fg("warning", `web_search using DuckDuckGo (set TAVILY_API_KEY for better results)`);
    return new Text(text, 0, 0);
  });

  pi.on("session_start", async (_event, ctx) => {
    pi.events.emit("module:show", { name: "web" });

    if (!ctx.hasUI) return;

    const alreadyShown = ctx.sessionManager.getBranch().some(
      (e) => e.type === "message" && e.message.role === "custom" && e.message.customType === "web-provider",
    );
    if (alreadyShown) return;

    pi.sendMessage({
      customType: "web-provider",
      content: "",
      display: true,
      details: { provider: provider.name, hasTavily: provider.name !== "duckduckgo" },
    });
  });

  pi.registerTool(
    moduleTag(pi, "web", {
      name: "web_search",
      label: "Web Search",
      description:
        "Search the web for information. Supports multiple queries for broader coverage. Results are deduplicated across queries.",
      parameters: Type.Object({
        queries: Type.Array(Type.String({ description: "Search query" }), {
          minItems: 1,
          maxItems: 5,
          description: "1-5 search queries",
        }),
        maxResults: Type.Optional(
          Type.Number({ description: "Max results per query (default 5)", default: 5 }),
        ),
      }),
      execute: (_toolCallId, params, signal) =>
        executeWebSearch(provider, params as WebSearchParams, signal),

      renderCall(args, theme) {
        const searchArgs = args as WebSearchParams;
        const q = searchArgs.queries.length === 1
          ? theme.fg("accent", `"${searchArgs.queries[0]}"`)
          : theme.fg("accent", `"${searchArgs.queries[0]}"`) + theme.fg("dim", ` + ${searchArgs.queries.length - 1} more`);
        return new Text(theme.fg("toolTitle", theme.bold("web_search ")) + q, 0, 0);
      },

      renderResult(result, { expanded }, theme) {
        const details = result.details as SearchDetails | undefined;
        if (!details) return;

        const { results } = details;
        if (results.length === 0) return new Text(theme.fg("dim", "No results found."), 0, 0);

        let text = theme.fg("muted", `${results.length} result(s)`);
        if (expanded) {
          for (const r of results) {
            let domain = "";
            try { domain = r.url ? theme.fg("dim", ` — ${new URL(r.url).hostname}`) : ""; } catch {}
            text += `\n  ${theme.fg("text", r.title)}${domain}`;
          }
        }
        return new Text(text, 0, 0);
      },
    }),
  );

  pi.registerTool(
    moduleTag(pi, "web", {
      name: "web_fetch",
      label: "Web Fetch",
      description:
        "Fetch a web page and extract its content as markdown. Uses Readability to strip navigation, ads, and sidebars.",
      parameters: Type.Object({
        url: Type.String({ description: "URL to fetch (must start with http:// or https://)" }),
        maxLength: Type.Optional(
          Type.Number({
            description: "Max characters to return (default 50000)",
            default: 50000,
          }),
        ),
      }),
      execute: (toolCallId, params, signal) =>
        executeWebFetch(toolCallId, params as WebFetchParams, signal),

      renderCall(args, theme) {
        const fetchArgs = args as WebFetchParams;
        let display: string;
        try {
          display = new URL(fetchArgs.url).hostname;
        } catch {
          display = fetchArgs.url;
        }
        return new Text(theme.fg("toolTitle", theme.bold("web_fetch ")) + theme.fg("accent", display), 0, 0);
      },

      renderResult(result, { expanded }, theme) {
        const details = result.details as FetchDetails | undefined;
        if (!details) return;

        const { result: r } = details;
        if (r.error) return new Text(theme.fg("error", r.error), 0, 0);

        const title = r.title || r.url;
        let text = theme.fg("muted", title) + theme.fg("dim", ` (${r.content.length} chars)`);
        if (expanded) {
          const preview = r.content.slice(0, 500).split("\n").slice(0, 10);
          for (const line of preview) {
            text += `\n  ${theme.fg("dim", line)}`;
          }
          if (r.content.length > 500) text += `\n  ${theme.fg("dim", "...")}`;
        }
        return new Text(text, 0, 0);
      },
    }),
  );
}

export async function executeWebSearch(
  provider: { search(query: string, maxResults: number): Promise<SearchResult[]> },
  params: WebSearchParams,
  signal?: AbortSignal,
) {
  const maxResults = params.maxResults ?? 5;
  const allResults = await searchAndDedupe(provider, params.queries, maxResults, signal);

  return {
    content: [{ type: "text" as const, text: formatSearchResults(allResults) }],
    details: { queries: params.queries, results: allResults } as SearchDetails,
  };
}

export async function executeWebFetch(
  _toolCallId: string,
  params: WebFetchParams,
  signal?: AbortSignal,
) {
  const fetchResult = await webFetch(params.url, params.maxLength, signal);

  if (fetchResult.error) {
    return {
      content: [{ type: "text" as const, text: `Error fetching ${params.url}: ${fetchResult.error}` }],
      details: { result: fetchResult } as FetchDetails,
    };
  }

  const header = fetchResult.title ? `# ${fetchResult.title}\n\nSource: ${fetchResult.url}\n\n` : "";
  return {
    content: [{ type: "text" as const, text: `${header}${fetchResult.content}` }],
    details: { result: fetchResult } as FetchDetails,
  };
}

export async function searchAndDedupe(
  provider: { search(query: string, maxResults: number): Promise<SearchResult[]> },
  queries: string[],
  maxResults: number,
  signal?: AbortSignal | null,
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    if (signal?.aborted) break;

    try {
      const results = await provider.search(query, maxResults);
      for (const result of results) {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          allResults.push(result);
        }
      }
    } catch (err) {
      allResults.push({
        title: `Error searching "${query}"`,
        url: "",
        snippet: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return allResults;
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return "No results found.";

  return results
    .map((r, i) => {
      const parts = [`### ${i + 1}. ${r.title}`];
      if (r.url) parts.push(r.url);
      if (r.snippet) parts.push(r.snippet);
      return parts.join("\n");
    })
    .join("\n\n");
}
