import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webFetch } from "../fetch/fetch.js";

const { mockParse, mockTurndown } = vi.hoisted(() => ({
  mockParse: vi.fn(),
  mockTurndown: vi.fn(),
}));

vi.mock("jsdom", () => ({
  JSDOM: vi.fn(function JSDOM() {
    return { window: { document: { title: "Test Page" } } };
  }),
}));

vi.mock("@mozilla/readability", () => ({
  Readability: vi.fn(function Readability() {
    return { parse: mockParse };
  }),
}));

vi.mock("turndown", () => ({
  default: vi.fn(function TurndownService() {
    return { turndown: mockTurndown };
  }),
}));

describe("webFetch", () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      throw new Error(`Unexpected fetch in test: ${String(input)}`);
    });
    globalThis.fetch = fetchMock as any;

    mockParse.mockReturnValue({ title: "Test Article", content: "<p>Content</p>" });
    mockTurndown.mockReturnValue("Markdown content");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("rejects non-http URLs", async () => {
    const result = await webFetch("ftp://example.com");
    expect(result.error).toBe("URL must start with http:// or https://");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("attempts the requested URL before fallback probes", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 404, headers: new Headers(), text: () => Promise.resolve("") })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/markdown" }),
        text: () => Promise.resolve("# Fallback"),
      });

    const result = await webFetch("https://example.com/page");

    expect(result.error).toBeNull();
    expect(result.content).toBe("# Fallback");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://example.com/page", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://example.com/page.md", expect.any(Object));
  });

  it("converts HTML to markdown", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      text: () => Promise.resolve("<html><body><p>Hello</p></body></html>"),
    });

    const result = await webFetch("https://example.com");

    expect(result.error).toBeNull();
    expect(result.content).toBe("Markdown content");
    expect(result.title).toBe("Test Article");
  });

  it("returns JSON pretty-printed", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve('{"name":"test","value":1}'),
    });

    const result = await webFetch("https://api.example.com/data");
    expect(result.error).toBeNull();
    expect(result.content).toContain('"name": "test"');
  });

  it("returns plain text as-is", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/plain" }),
      text: () => Promise.resolve("Just plain text."),
    });

    const result = await webFetch("https://example.com/file.txt");
    expect(result.error).toBeNull();
    expect(result.content).toBe("Just plain text.");
  });

  it("rejects unsupported binary content types", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/pdf" }),
      text: () => Promise.resolve(""),
    });

    const result = await webFetch("https://example.com/file.pdf");
    expect(result.error).toContain("Cannot extract content from application/pdf");
  });

  it("rejects responses over 5MB", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "6000000" }),
      text: () => Promise.resolve(""),
    });

    const result = await webFetch("https://example.com");
    expect(result.error).toBe("Response exceeds 5MB size limit");
  });

  it("returns error for non-ok responses", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 404, headers: new Headers(), text: () => Promise.resolve("") })
      .mockResolvedValueOnce({ ok: false, status: 404, headers: new Headers(), text: () => Promise.resolve("") })
      .mockResolvedValueOnce({ ok: false, status: 404, headers: new Headers(), text: () => Promise.resolve("") });

    const result = await webFetch("https://example.com");
    expect(result.error).toBe("HTTP 404");
  });

  it("truncates at paragraph boundary", async () => {
    mockTurndown.mockReturnValue("Paragraph one.\n\nParagraph two.\n\nParagraph three is long.");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      text: () => Promise.resolve("<html><body>content</body></html>"),
    });

    const result = await webFetch("https://example.com", 40);
    expect(result.content).toBe("Paragraph one.\n\nParagraph two.");
  });

  it("normalizes aborted requests", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));

    const result = await webFetch("https://example.com");
    expect(result.error).toBe("Request aborted");
  });

  it("passes external signal to fetch", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/plain" }),
      text: () => Promise.resolve("ok"),
    });

    const controller = new AbortController();
    await webFetch("https://example.com", 50_000, controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  // Truncation for web_search output is intentionally deferred by product decision.
  // Keep fetch tests focused on network/content behavior only.
});
