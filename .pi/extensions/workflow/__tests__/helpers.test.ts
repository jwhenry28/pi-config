import { describe, it, expect } from "vitest";
import { registerMockModel, runWorkflow } from "./helpers.js";

describe("test helpers", () => {
  it("exports all helper functions", () => {
    expect(typeof registerMockModel).toBe("function");
    expect(typeof runWorkflow).toBe("function");
  });
});
