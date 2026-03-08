import { describe, it, expect } from "vitest";
import { CollectedEvents } from "../component/events.js";

describe("CollectedEvents", () => {
  it("collects events and filters by type", () => {
    const collected = new CollectedEvents();

    collected.push({ type: "agent_start" });
    collected.push({ type: "turn_start" });
    collected.push({ type: "turn_end", message: { role: "assistant" } });
    collected.push({ type: "agent_end", messages: [] });

    expect(collected.all).toHaveLength(4);
    expect(collected.ofType("turn_start")).toHaveLength(1);
    expect(collected.ofType("agent_end")).toHaveLength(1);
  });

  it("extracts tool calls", () => {
    const collected = new CollectedEvents();

    collected.push({
      type: "tool_execution_start",
      toolName: "read",
      args: { path: "foo.txt" },
    });

    const calls = collected.toolCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ toolName: "read", args: { path: "foo.txt" } });
  });

  it("extracts tool results", () => {
    const collected = new CollectedEvents();

    collected.push({
      type: "tool_execution_end",
      toolName: "read",
      result: "file contents",
      isError: false,
    });

    const results = collected.toolResults();
    expect(results).toHaveLength(1);
    expect(results[0].isError).toBe(false);
    expect(results[0].result).toBe("file contents");
  });

  it("clears all events", () => {
    const collected = new CollectedEvents();
    collected.push({ type: "agent_start" });
    collected.push({ type: "agent_end", messages: [] });

    collected.clear();

    expect(collected.all).toHaveLength(0);
  });
});
