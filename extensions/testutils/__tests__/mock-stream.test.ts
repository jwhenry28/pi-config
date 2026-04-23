import { describe, it, expect } from "vitest";
import { MockStreamController, createDummyModel } from "../component/mock-stream.js";

describe("MockStreamController", () => {
  it("fails immediately when streamFn is called without a queued response", async () => {
    const controller = new MockStreamController();
    const model = createDummyModel();

    const events: any[] = [];
    for await (const event of controller.streamFn(model, { messages: [] } as any)) {
      events.push(event);
    }

    expect(controller.consumePendingError()?.message).toContain("queued mock response");
    expect(events.some((e) => e.type === "error")).toBe(true);
  });

  it("yields a text response", async () => {
    const controller = new MockStreamController();
    const model = createDummyModel();

    const providePromise = controller.provide({ text: "Hello world" });
    const eventStream = controller.streamFn(model, { messages: [] });

    const eventsPromise = (async () => {
      const events: any[] = [];
      for await (const event of eventStream) {
        events.push(event);
      }
      return events;
    })();

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

    const providePromise = controller.provide({ toolCalls: [{ name: "read_file", args: { path: "foo.txt" } }] });
    const eventStream = controller.streamFn(model, { messages: [] });

    const eventsPromise = (async () => {
      const events: any[] = [];
      for await (const event of eventStream) {
        events.push(event);
      }
      return events;
    })();

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
