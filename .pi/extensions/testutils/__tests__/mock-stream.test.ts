import { describe, it, expect } from "vitest";
import { MockStreamController, createDummyModel } from "../component/mock-stream.js";

describe("MockStreamController", () => {
  it("yields a text response", async () => {
    const controller = new MockStreamController();
    const model = createDummyModel();

    const eventStream = controller.streamFn(model, { messages: [] });

    const eventsPromise = (async () => {
      const events: any[] = [];
      for await (const event of eventStream) {
        events.push(event);
      }
      return events;
    })();

    // provide() waits for consumption; since there's no agent loop calling
    // streamFn again, we need to notifyIdle after a delay
    const providePromise = controller.provide({ text: "Hello world" });
    await new Promise((r) => setTimeout(r, 50));
    controller.notifyIdle();
    await providePromise;

    const events = await eventsPromise;
    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
    expect(doneEvent.message.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "text", text: "Hello world" })])
    );
    expect(doneEvent.reason).toBe("stop");
  });

  it("yields a tool call response", async () => {
    const controller = new MockStreamController();
    const model = createDummyModel();

    const eventStream = controller.streamFn(model, { messages: [] });

    const eventsPromise = (async () => {
      const events: any[] = [];
      for await (const event of eventStream) {
        events.push(event);
      }
      return events;
    })();

    const providePromise = controller.provide({ toolCalls: [{ name: "read_file", args: { path: "foo.txt" } }] });
    await new Promise((r) => setTimeout(r, 50));
    controller.notifyIdle();
    await providePromise;

    const events = await eventsPromise;
    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent.reason).toBe("toolUse");
    expect(doneEvent.message.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "toolCall",
          name: "read_file",
          arguments: { path: "foo.txt" },
        }),
      ])
    );
  });
});
