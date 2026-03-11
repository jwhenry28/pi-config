import { afterEach, describe, expect, it, vi } from "vitest";
import { createComponentTest, type ComponentTestSession } from "../../testutils/component/index.js";

describe("web extension agent-loop tools", () => {
  const originalFetch = globalThis.fetch;
  let test: ComponentTestSession | undefined;

  afterEach(() => {
    test?.dispose();
    test = undefined;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("runs web_search through the agent loop", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      text: () =>
        Promise.resolve(`
          <div class="result">
            <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fvitest.dev">Vitest</a>
            <a class="result__snippet">Fast tests</a>
          </div>
        `),
    }) as any;

    test = await createComponentTest({ shownModules: ["web"] });

    test.sendUserMessage("Find recent updates about Vitest");
    await test.mockAgentResponse({
      toolCalls: [{ name: "web_search", args: { queries: ["vitest updates"], maxResults: 2 } }],
    });

    const toolCalls = test.events.toolCalls().filter((event) => event.toolName === "web_search");
    const toolResults = test.events.toolResults().filter((event) => event.toolName === "web_search");

    expect(toolCalls.length).toBeGreaterThan(0);
    expect(toolCalls[0]?.args).toEqual({ queries: ["vitest updates"], maxResults: 2 });
    expect(toolResults.length).toBeGreaterThan(0);
    expect(toolResults[0]?.isError).toBe(false);
    expect(toolResults[0]?.result?.content?.[0]?.text).toContain("Vitest");
  });

  it("runs web_fetch through the agent loop", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/plain" }),
      text: () => Promise.resolve("Fetched page"),
    }) as any;

    test = await createComponentTest({ shownModules: ["web"] });

    test.sendUserMessage("Fetch this page for me");
    await test.mockAgentResponse({
      toolCalls: [{ name: "web_fetch", args: { url: "https://example.com", maxLength: 200 } }],
    });

    const toolCalls = test.events.toolCalls().filter((event) => event.toolName === "web_fetch");
    const toolResults = test.events.toolResults().filter((event) => event.toolName === "web_fetch");

    expect(toolCalls.length).toBeGreaterThan(0);
    expect(toolCalls[0]?.args).toEqual({ url: "https://example.com", maxLength: 200 });
    expect(toolResults.length).toBeGreaterThan(0);
    expect(toolResults[0]?.toolName).toBe("web_fetch");
    expect(typeof toolResults[0]?.isError).toBe("boolean");
  });
});
