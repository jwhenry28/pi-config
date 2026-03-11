import { describe, it, expect, vi } from "vitest";
import { formatSearchResults, searchAndDedupe } from "../index.js";
import type { SearchResult } from "../search/types.js";

describe("formatSearchResults", () => {
  it("formats results as numbered markdown", () => {
    const results: SearchResult[] = [
      { title: "First", url: "https://example.com/1", snippet: "Snippet 1" },
      { title: "Second", url: "https://example.com/2", snippet: "Snippet 2" },
    ];
    const md = formatSearchResults(results);

    expect(md).toContain("### 1. First");
    expect(md).toContain("https://example.com/1");
    expect(md).toContain("### 2. Second");
  });

  it("returns message for empty results", () => {
    expect(formatSearchResults([])).toBe("No results found.");
  });
});

describe("searchAndDedupe", () => {
  it("deduplicates results by URL across queries", async () => {
    const provider = {
      search: vi
        .fn()
        .mockResolvedValueOnce([
          { title: "A", url: "https://example.com/shared", snippet: "a" },
          { title: "B", url: "https://example.com/unique-1", snippet: "b" },
        ])
        .mockResolvedValueOnce([
          { title: "A dup", url: "https://example.com/shared", snippet: "a dup" },
          { title: "C", url: "https://example.com/unique-2", snippet: "c" },
        ]),
    };

    const results = await searchAndDedupe(provider, ["q1", "q2"], 5);

    expect(results).toHaveLength(3);
    expect(results.filter((r) => r.url === "https://example.com/shared")).toHaveLength(1);
  });

  it("includes error results when provider throws", async () => {
    const provider = {
      search: vi.fn().mockRejectedValue(new Error("API down")),
    };

    const results = await searchAndDedupe(provider, ["fail"], 5);

    expect(results).toHaveLength(1);
    expect(results[0]!.title).toContain("Error");
    expect(results[0]!.snippet).toContain("API down");
  });
});
