import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createTimer,
  cancelTimer,
  listTimers,
  clearAll,
  getTimerCount,
} from "../state.js";

describe("timer state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAll();
  });

  afterEach(() => {
    clearAll();
    vi.useRealTimers();
  });

  describe("createTimer", () => {
    it("creates a one-shot timer and fires callback after delay", () => {
      const cb = vi.fn();
      const entry = createTimer({
        prompt: "Check logs",
        intervalMs: 5 * 60 * 1000,
        durationStr: "5m",
        recurring: false,
        onFire: cb,
      });

      expect(entry.id).toMatch(/^[0-9a-f]{6}$/);
      expect(entry.prompt).toBe("Check logs");
      expect(entry.recurring).toBe(false);
      expect(getTimerCount()).toBe(1);

      // Advance time to fire
      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(entry.id);
      // One-shot auto-removes
      expect(getTimerCount()).toBe(0);
    });

    it("creates a recurring timer that fires multiple times", () => {
      const cb = vi.fn();
      const entry = createTimer({
        prompt: "Ping",
        intervalMs: 60 * 1000,
        durationStr: "1m",
        recurring: true,
        onFire: cb,
      });

      expect(entry.recurring).toBe(true);
      expect(getTimerCount()).toBe(1);

      vi.advanceTimersByTime(60 * 1000);
      expect(cb).toHaveBeenCalledTimes(1);
      // Recurring stays in map
      expect(getTimerCount()).toBe(1);

      vi.advanceTimersByTime(60 * 1000);
      expect(cb).toHaveBeenCalledTimes(2);
      expect(getTimerCount()).toBe(1);
    });
  });

  describe("cancelTimer", () => {
    it("cancels an existing timer and returns true", () => {
      const cb = vi.fn();
      const entry = createTimer({
        prompt: "Check",
        intervalMs: 60_000,
        durationStr: "1m",
        recurring: false,
        onFire: cb,
      });

      const result = cancelTimer(entry.id);
      expect(result).toBe(true);
      expect(getTimerCount()).toBe(0);

      vi.advanceTimersByTime(60_000);
      expect(cb).not.toHaveBeenCalled();
    });

    it("returns false for unknown ID", () => {
      expect(cancelTimer("abcdef")).toBe(false);
    });
  });

  describe("listTimers", () => {
    it("returns empty array when no timers", () => {
      expect(listTimers()).toEqual([]);
    });

    it("returns info for all active timers", () => {
      const cb = vi.fn();
      createTimer({ prompt: "A", intervalMs: 60_000, durationStr: "1m", recurring: false, onFire: cb });
      createTimer({ prompt: "B", intervalMs: 7_200_000, durationStr: "2h", recurring: true, onFire: cb });

      const list = listTimers();
      expect(list).toHaveLength(2);
      expect(list[0]).toEqual(expect.objectContaining({ prompt: "A", durationStr: "1m", recurring: false }));
      expect(list[1]).toEqual(expect.objectContaining({ prompt: "B", durationStr: "2h", recurring: true }));
    });
  });

  describe("clearAll", () => {
    it("clears all timers and prevents callbacks", () => {
      const cb = vi.fn();
      createTimer({ prompt: "A", intervalMs: 60_000, durationStr: "1m", recurring: false, onFire: cb });
      createTimer({ prompt: "B", intervalMs: 60_000, durationStr: "1m", recurring: true, onFire: cb });

      clearAll();
      expect(getTimerCount()).toBe(0);

      vi.advanceTimersByTime(120_000);
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
