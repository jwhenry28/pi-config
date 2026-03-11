import * as cheerio from "cheerio";
import type { SearchProvider, SearchResult } from "./types.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export class DuckDuckGoProvider implements SearchProvider {
  name = "duckduckgo";

  async search(query: string, maxResults: number): Promise<SearchResult[]> {
    let results = await this.fetchResults(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    );

    if (results.length === 0) {
      results = await this.fetchResults(
        `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
      );
    }

    return results.slice(0, maxResults);
  }

  private async fetchResults(url: string): Promise<SearchResult[]> {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo returned ${response.status}`);
    }

    const html = await response.text();

    if (html.includes("anomaly-modal") || html.includes("challenge-form")) {
      throw new Error("DuckDuckGo is requesting a CAPTCHA — too many requests. Set TAVILY_API_KEY for reliable search.");
    }

    return this.parseHtml(html);
  }

  parseHtml(html: string): SearchResult[] {
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".result").each((_i, el) => {
      const $el = $(el);
      const $link = $el.find(".result__a");
      const $snippet = $el.find(".result__snippet");

      const title = $link.text().trim();
      const rawHref = $link.attr("href") ?? "";
      const snippet = $snippet.text().trim();

      if (!title || !rawHref) return;

      const url = this.decodeRedirectUrl(rawHref);
      if (!url) return;

      results.push({ title, url, snippet });
    });

    return results;
  }

  private decodeRedirectUrl(href: string): string | null {
    try {
      const parsed = new URL(href, "https://duckduckgo.com");
      const uddg = parsed.searchParams.get("uddg");
      if (uddg) return uddg;
      // If no redirect param, use the href directly if it's a valid URL
      if (href.startsWith("http")) return href;
      return null;
    } catch {
      return null;
    }
  }
}
