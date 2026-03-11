import { describe, it, expect, afterEach } from "vitest";
import { getCwd, setCwdOverride, clearCwdOverride } from "../cwd.js";

describe("getCwd", () => {
  afterEach(() => {
    clearCwdOverride();
  });

  it("returns ctx.cwd when no override is set", () => {
    expect(getCwd({ cwd: "/project" })).toBe("/project");
  });

  it("returns override when set", () => {
    setCwdOverride("/tmp/test");
    expect(getCwd({ cwd: "/project" })).toBe("/tmp/test");
  });

  it("clearCwdOverride restores ctx.cwd behavior", () => {
    setCwdOverride("/tmp/test");
    clearCwdOverride();
    expect(getCwd({ cwd: "/project" })).toBe("/project");
  });

  it("throws when no override and ctx.cwd is empty", () => {
    expect(() => getCwd({ cwd: "" })).toThrow();
  });

  it("throws when no override and ctx.cwd is undefined", () => {
    expect(() => getCwd({})).toThrow();
  });
});
