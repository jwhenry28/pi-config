import { describe, it, expect, afterEach } from "vitest";
import { setConditionStreamFnOverride } from "../evaluator.js";

describe("evaluator DI", () => {
  afterEach(() => {
    setConditionStreamFnOverride(undefined);
  });

  it("exports setConditionStreamFnOverride function", () => {
    expect(typeof setConditionStreamFnOverride).toBe("function");
  });
});
