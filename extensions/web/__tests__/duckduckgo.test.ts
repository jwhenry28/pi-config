import { describe, it, expect, vi, afterEach } from "vitest";
import { DuckDuckGoProvider } from "../search/duckduckgo.js";

describe("DuckDuckGoProvider", () => {
  const provider = new DuckDuckGoProvider();
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const ddgHtml = (entries: Array<{ href: string; title: string; snippet: string }>) =>
    entries
      .map(
        (e) => `
      <div class="result">
        <a class="result__a" href="${e.href}">${e.title}</a>
        <a class="result__snippet">${e.snippet}</a>
      </div>`,
      )
      .join("");

  describe("parseHtml", () => {
    it("extracts titles, decoded URLs, and snippets", () => {
      const html = ddgHtml([
        { href: "//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage1", title: "Page 1", snippet: "First" },
        { href: "//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage2&rut=abc", title: "Page 2", snippet: "Second" },
      ]);

      const results = provider.parseHtml(html);
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ title: "Page 1", url: "https://example.com/page1", snippet: "First" });
      expect(results[1]!.url).toBe("https://example.com/page2");
    });

    it("returns empty for no results", () => {
      expect(provider.parseHtml("<html><body></body></html>")).toHaveLength(0);
    });

    it("skips entries without valid URLs", () => {
      const html = ddgHtml([{ href: "", title: "No URL", snippet: "Snippet" }]);
      expect(provider.parseHtml(html)).toHaveLength(0);
    });
  });

  describe("search", () => {
    it("falls back to lite endpoint when main returns no results", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve("<html></html>") })
        .mockResolvedValueOnce({
          ok: true,
          text: () =>
            Promise.resolve(
              ddgHtml([{ href: "//duckduckgo.com/l/?uddg=https%3A%2F%2Flite.example.com", title: "Lite", snippet: "From lite" }]),
            ),
        });

      globalThis.fetch = mockFetch;
      const results = await provider.search("test", 5);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1]![0]).toContain("lite.duckduckgo.com");
      expect(results).toHaveLength(1);
    });

    it("throws on non-ok response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });
      await expect(provider.search("test", 5)).rejects.toThrow("DuckDuckGo returned 429");
    });

    it("throws on CAPTCHA challenge", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><form id="challenge-form"><div class="anomaly-modal">CAPTCHA</div></form></html>'),
      });
      await expect(provider.search("test", 5)).rejects.toThrow("CAPTCHA");
    });
  });
});
