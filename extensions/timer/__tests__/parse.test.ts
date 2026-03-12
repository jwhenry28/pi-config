import { describe, it, expect } from "vitest";
import { parseDuration } from "../parse.js";

describe("parseDuration", () => {
  it("parses minutes", () => {
    expect(parseDuration("5m")).toEqual({ ms: 5 * 60 * 1000, display: "5m" });
    expect(parseDuration("60m")).toEqual({ ms: 60 * 60 * 1000, display: "60m" });
    expect(parseDuration("1m")).toEqual({ ms: 60 * 1000, display: "1m" });
  });

  it("parses hours", () => {
    expect(parseDuration("2h")).toEqual({ ms: 2 * 60 * 60 * 1000, display: "2h" });
    expect(parseDuration("1h")).toEqual({ ms: 60 * 60 * 1000, display: "1h" });
  });

  it("is case-insensitive and normalizes display to lowercase", () => {
    expect(parseDuration("5M")).toEqual({ ms: 5 * 60 * 1000, display: "5m" });
    expect(parseDuration("2H")).toEqual({ ms: 2 * 60 * 60 * 1000, display: "2h" });
  });

  it("returns null for invalid formats", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("5s")).toBeNull();
    expect(parseDuration("1h30m")).toBeNull();
    expect(parseDuration("m")).toBeNull();
    expect(parseDuration("0m")).toBeNull();
    expect(parseDuration("-5m")).toBeNull();
  });
});
