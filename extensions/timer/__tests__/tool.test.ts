import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { executeSetTimer, executeListTimers, executeCancelTimer } from "../index.js";
import { clearAll, getTimerCount } from "../state.js";

const sentUserMessages: string[] = [];
const notifications: Array<{ msg: string; level: string }> = [];

const mockPi = {
  sendUserMessage: (msg: string) => { sentUserMessages.push(msg); },
};

const mockUi = {
  notify: (msg: string, level: string) => { notifications.push({ msg, level }); },
};

beforeEach(() => {
  vi.useFakeTimers();
  clearAll();
  sentUserMessages.length = 0;
  notifications.length = 0;
});

afterEach(() => {
  clearAll();
  vi.useRealTimers();
});

describe("executeSetTimer", () => {
  it("creates a one-shot timer and returns confirmation with ID", () => {
    const result = executeSetTimer(
      { duration: "5m", prompt: "Review build logs", recurring: false },
      mockUi,
      mockPi as any,
    );

    expect(result.content[0].text).toContain("5m");
    expect(result.content[0].text).toContain("Review build logs");
    expect(result.content[0].text).toMatch(/ID: [a-f0-9]+/);
    expect(getTimerCount()).toBe(1);
  });

  it("creates a recurring timer and returns confirmation", () => {
    const result = executeSetTimer(
      { duration: "2h", prompt: "Check status", recurring: true },
      mockUi,
      mockPi as any,
    );

    expect(result.content[0].text).toContain("recurring");
    expect(result.content[0].text).toContain("2h");
    expect(result.content[0].text).toMatch(/ID: [a-f0-9]+/);
    expect(getTimerCount()).toBe(1);
  });

  it("returns error for invalid duration", () => {
    const result = executeSetTimer(
      { duration: "abc", prompt: "Do stuff", recurring: false },
      mockUi,
      mockPi as any,
    );

    expect(result.content[0].text).toContain("Invalid duration");
    expect(getTimerCount()).toBe(0);
  });

  it("fires the timer and sends user message", () => {
    executeSetTimer(
      { duration: "1m", prompt: "Time is up", recurring: false },
      mockUi,
      mockPi as any,
    );

    vi.advanceTimersByTime(60_000);

    expect(sentUserMessages).toContain("Time is up");
    expect(getTimerCount()).toBe(0);
  });
});

describe("executeListTimers", () => {
  it("returns 'no active timers' when empty", () => {
    const result = executeListTimers();
    expect(result.content[0].text).toBe("No active timers.");
  });

  it("lists active timers with their details", () => {
    executeSetTimer(
      { duration: "5m", prompt: "First task", recurring: false },
      mockUi,
      mockPi as any,
    );
    executeSetTimer(
      { duration: "2h", prompt: "Second task", recurring: true },
      mockUi,
      mockPi as any,
    );

    const result = executeListTimers();
    const text = result.content[0].text;

    expect(text).toContain("5m");
    expect(text).toContain("First task");
    expect(text).toContain("one-shot");
    expect(text).toContain("2h");
    expect(text).toContain("Second task");
    expect(text).toContain("recurring");
  });
});

describe("executeCancelTimer", () => {
  it("cancels an existing timer and notifies", () => {
    const setResult = executeSetTimer(
      { duration: "5m", prompt: "Cancel me", recurring: false },
      mockUi,
      mockPi as any,
    );

    const id = setResult.content[0].text.match(/ID: ([a-f0-9]+)/)![1];
    expect(getTimerCount()).toBe(1);

    const cancelResult = executeCancelTimer(id, mockUi);
    expect(cancelResult.content[0].text).toBe(`Cancelled timer ${id}.`);
    expect(getTimerCount()).toBe(0);
    expect(notifications.some((n) => n.msg.includes(id) && n.level === "info")).toBe(true);
  });

  it("returns error for unknown timer ID", () => {
    const result = executeCancelTimer("nonexistent", mockUi);
    expect(result.content[0].text).toContain("not found");
  });
});
