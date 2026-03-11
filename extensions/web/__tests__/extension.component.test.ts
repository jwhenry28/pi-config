import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeMockPi } from "./helpers/mock-extension-api.js";

const { searchMock, webFetchMock } = vi.hoisted(() => ({
  searchMock: vi.fn(),
  webFetchMock: vi.fn(),
}));

vi.mock("../search/provider.js", () => ({
  createSearchProvider: () => ({ name: "duckduckgo", search: searchMock }),
}));

vi.mock("../fetch/fetch.js", () => ({
  webFetch: webFetchMock,
}));

import webExtension, { executeWebFetch, executeWebSearch } from "../index.ts";

describe("web extension component wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers web_search and web_fetch tools", () => {
    const { pi, tools } = makeMockPi();

    webExtension(pi as any);

    expect(tools.has("web_search")).toBe(true);
    expect(tools.has("web_fetch")).toBe(true);
  });

  it("exports named execute helpers", () => {
    expect(typeof executeWebSearch).toBe("function");
    expect(typeof executeWebFetch).toBe("function");
  });

  it("web_search execute returns content and details", async () => {
    searchMock.mockResolvedValue([{ title: "Vitest", url: "https://vitest.dev", snippet: "Fast unit tests" }]);
    const { pi, tools } = makeMockPi();
    webExtension(pi as any);

    const tool = tools.get("web_search")!;
    const signal = new AbortController().signal;
    const result = await tool.execute("call-1", { queries: ["vitest updates"], maxResults: 2 }, signal);

    expect(result.content[0].text).toContain("Vitest");
    expect(result.details.queries).toEqual(["vitest updates"]);
    expect(result.details.results).toHaveLength(1);
  });

  it("web_fetch execute forwards params and signal", async () => {
    webFetchMock.mockResolvedValue({ url: "https://example.com", title: "Title", content: "content", error: null });
    const { pi, tools } = makeMockPi();
    webExtension(pi as any);

    const tool = tools.get("web_fetch")!;
    const signal = new AbortController().signal;
    const result = await tool.execute("call-2", { url: "https://example.com", maxLength: 111 }, signal);

    expect(webFetchMock).toHaveBeenCalledWith("https://example.com", 111, signal);
    expect(result.content[0].text).toContain("# Title");
    expect(result.details.result.error).toBeNull();
  });

  it("message renderer reads message.details", () => {
    const { pi, registerMessageRenderer } = makeMockPi();
    webExtension(pi as any);

    const renderer = registerMessageRenderer.mock.calls[0][1];
    const rendered = renderer(
      { details: { provider: "duckduckgo", hasTavily: false } },
      {},
      { fg: (_: string, text: string) => text },
    );

    expect(rendered).toBeDefined();
  });
});
