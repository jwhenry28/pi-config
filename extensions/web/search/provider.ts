import type { SearchProvider } from "./types.js";
import { TavilyProvider } from "./tavily.js";
import { DuckDuckGoProvider } from "./duckduckgo.js";

export function createSearchProvider(): SearchProvider {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) return new TavilyProvider(tavilyKey);
  return new DuckDuckGoProvider();
}
