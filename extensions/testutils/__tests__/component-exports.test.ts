import { describe, it, expect } from "vitest";
import {
  MockStreamController,
  createDummyModel,
  CollectedEvents,
  createComponentTest,
} from "../component/index.js";

describe("component testutils exports", () => {
  it("exports all public API", () => {
    expect(typeof MockStreamController).toBe("function");
    expect(typeof createDummyModel).toBe("function");
    expect(typeof CollectedEvents).toBe("function");
    expect(typeof createComponentTest).toBe("function");
  });
});
