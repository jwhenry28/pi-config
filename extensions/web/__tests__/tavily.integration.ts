import { describe, it, expect } from "vitest";
import { TavilyProvider } from "../search/tavily.js";

describe.skipIf(!process.env.TAVILY_API_KEY)("Tavily integration", () => {
  const provider = new TavilyProvider(process.env.TAVILY_API_KEY!);

  it("returns search results for a known query", async () => {
    const results = await provider.search("TypeScript programming language", 3);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("title");
    expect(results[0]).toHaveProperty("url");
    expect(results[0]).toHaveProperty("snippet");
    expect(results[0]!.url).toMatch(/^https?:\/\//);
  }, 15_000);

  it("respects maxResults", async () => {
    const results = await provider.search("JavaScript frameworks 2024", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  }, 15_000);
});
