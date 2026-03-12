import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handleTimerCommand, parseSetArgs } from "../index.js";
import { clearAll, getTimerCount, listTimers } from "../state.js";

describe("parseSetArgs", () => {
  it("parses duration and prompt", () => {
    const result = parseSetArgs(["set", "5m", "Check", "the", "logs"]);
    expect(result).toEqual({ durationStr: "5m", recurring: false, prompt: "Check the logs" });
  });

  it("parses --recurring flag anywhere after duration", () => {
    const result = parseSetArgs(["set", "2h", "--recurring", "Review", "PR"]);
    expect(result).toEqual({ durationStr: "2h", recurring: true, prompt: "Review PR" });
  });

  it("parses --recurring flag at end", () => {
    const result = parseSetArgs(["set", "1m", "Ping", "--recurring"]);
    expect(result).toEqual({ durationStr: "1m", recurring: true, prompt: "Ping" });
  });

  it("returns null when no duration", () => {
    expect(parseSetArgs(["set"])).toBeNull();
  });

  it("returns null when no prompt after duration", () => {
    expect(parseSetArgs(["set", "5m"])).toBeNull();
    expect(parseSetArgs(["set", "5m", "--recurring"])).toBeNull();
  });
});

describe("handleTimerCommand", () => {
  const notifications: Array<{ msg: string; level: string }> = [];
  let sentUserMessages: string[] = [];

  const ui = {
    notify: (msg: string, level: string) => { notifications.push({ msg, level }); },
  };

  const mockPi = {
    sendUserMessage: (msg: string) => { sentUserMessages.push(msg); },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    clearAll();
    notifications.length = 0;
    sentUserMessages = [];
  });

  afterEach(() => {
    clearAll();
    vi.useRealTimers();
  });

  it("shows help with no args", () => {
    handleTimerCommand("", ui, mockPi as any);
    expect(notifications[0].msg).toContain("Usage:");
  });

  it("shows help with 'help' subcommand", () => {
    handleTimerCommand("help", ui, mockPi as any);
    expect(notifications[0].msg).toContain("Usage:");
  });

  it("creates a one-shot timer with 'set'", () => {
    handleTimerCommand("set 5m Check the build", ui, mockPi as any);
    expect(notifications[0].level).toBe("info");
    expect(notifications[0].msg).toContain("5m");
    expect(notifications[0].msg).toContain("Check the build");
    expect(getTimerCount()).toBe(1);
  });

  it("fires a one-shot timer and sends user message", () => {
    handleTimerCommand("set 1m Do the thing", ui, mockPi as any);
    notifications.length = 0;

    vi.advanceTimersByTime(60_000);

    // Should have notified about firing
    expect(notifications.some(n => n.msg.includes("fired"))).toBe(true);
    // Should have sent user message
    expect(sentUserMessages).toContain("Do the thing");
    // Timer should be gone
    expect(getTimerCount()).toBe(0);
  });

  it("creates a recurring timer", () => {
    handleTimerCommand("set 1m --recurring Ping me", ui, mockPi as any);
    expect(notifications[0].msg).toContain("recurring");
    expect(getTimerCount()).toBe(1);
  });

  it("fires recurring timer multiple times", () => {
    handleTimerCommand("set 1m --recurring Ping me", ui, mockPi as any);
    notifications.length = 0;

    vi.advanceTimersByTime(60_000);
    expect(sentUserMessages).toHaveLength(1);

    vi.advanceTimersByTime(60_000);
    expect(sentUserMessages).toHaveLength(2);
    // Still active
    expect(getTimerCount()).toBe(1);
  });

  it("errors on invalid duration", () => {
    handleTimerCommand("set abc Do stuff", ui, mockPi as any);
    expect(notifications[0].level).toBe("error");
    expect(notifications[0].msg).toContain("Invalid duration");
  });

  it("errors on missing prompt", () => {
    handleTimerCommand("set 5m", ui, mockPi as any);
    expect(notifications[0].level).toBe("error");
  });

  it("lists active timers", () => {
    handleTimerCommand("set 5m Task A", ui, mockPi as any);
    handleTimerCommand("set 2h --recurring Task B", ui, mockPi as any);
    notifications.length = 0;

    handleTimerCommand("list", ui, mockPi as any);
    expect(notifications[0].msg).toContain("Task A");
    expect(notifications[0].msg).toContain("Task B");
    expect(notifications[0].msg).toContain("one-shot");
    expect(notifications[0].msg).toContain("recurring");
  });

  it("lists shows 'no active timers' when empty", () => {
    handleTimerCommand("list", ui, mockPi as any);
    expect(notifications[0].msg).toContain("No active timers");
  });

  it("cancels a timer by ID", () => {
    handleTimerCommand("set 5m Task to cancel", ui, mockPi as any);
    const id = notifications[0].msg.match(/([0-9a-f]{6})/)?.[1];
    expect(id).toBeDefined();
    notifications.length = 0;

    handleTimerCommand(`cancel ${id}`, ui, mockPi as any);
    expect(notifications[0].msg).toContain("Cancelled");
    expect(getTimerCount()).toBe(0);
  });

  it("errors when cancelling unknown ID", () => {
    handleTimerCommand("cancel abcdef", ui, mockPi as any);
    expect(notifications[0].level).toBe("error");
    expect(notifications[0].msg).toContain("not found");
  });

  it("errors when cancel has no ID", () => {
    handleTimerCommand("cancel", ui, mockPi as any);
    expect(notifications[0].level).toBe("error");
  });

  it("warns on unknown subcommand", () => {
    handleTimerCommand("bogus", ui, mockPi as any);
    expect(notifications[0].level).toBe("warning");
  });
});
