import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { executeSetTimer } from "../index.js";
import { clearAll, getTimerCount } from "../state.js";

describe("executeSetTimer", () => {
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

  it("creates a one-shot timer and returns confirmation", () => {
    const result = executeSetTimer(
      { duration: "5m", prompt: "Review build logs", recurring: false },
      mockUi,
      mockPi as any,
    );

    expect(result.content[0].text).toContain("5m");
    expect(result.content[0].text).toContain("Review build logs");
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
