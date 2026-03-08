import { describe, it, expect, afterEach } from "vitest";
import { createComponentTest, type ComponentTestSession } from "../component/session.js";

describe("createComponentTest", () => {
  let test: ComponentTestSession | undefined;

  afterEach(() => {
    test?.dispose();
    test = undefined;
  });

  it("creates a session and handles a simple text response", async () => {
    test = await createComponentTest();

    test.sendUserMessage("say hello");
    await test.mockAgentResponse({ text: "Hello from mock!" });
    await test.waitForIdle();

    const turns = test.events.ofType("turn_end");
    expect(turns.length).toBeGreaterThanOrEqual(1);

    const agentEnd = test.events.ofType("agent_end");
    expect(agentEnd).toHaveLength(1);
  });

  it("handles multiple turns sequentially", async () => {
    test = await createComponentTest();

    test.sendUserMessage("first question");
    await test.mockAgentResponse({ text: "First response" });
    await test.waitForIdle();

    test.sendUserMessage("second question");
    await test.mockAgentResponse({ text: "Second response" });
    await test.waitForIdle();

    const turns = test.events.ofType("turn_end");
    expect(turns.length).toBeGreaterThanOrEqual(2);
  });
});
