import { describe, it, expect } from "vitest";
import { getRegistry, findEntry, getAllNames } from "../registry.js";

describe("config registry", () => {
  it("returns all registry entries", () => {
    const entries = getRegistry();
    expect(entries.length).toBe(3);
    expect(entries.map((e) => e.name)).toEqual(["smart", "general", "fast"]);
  });

  it("finds entry by name", () => {
    const entry = findEntry("smart");
    expect(entry).toBeDefined();
    expect(entry!.name).toBe("smart");
    expect(entry!.default).toBe("claude-opus-4-6");
    expect(entry!.description).toBe("Model alias for complex tasks");
  });

  it("returns undefined for unknown key", () => {
    expect(findEntry("nonexistent")).toBeUndefined();
  });

  it("returns all names", () => {
    expect(getAllNames()).toEqual(["smart", "general", "fast"]);
  });

  it("each entry has a validator", () => {
    for (const entry of getRegistry()) {
      expect(entry.validator).toBeDefined();
    }
  });

  describe("model validator", () => {
    const mockCtx = {
      cwd: process.cwd(),
      storeName: "test",
      ui: { notify: () => {} },
      modelRegistry: {
        getAll: () => [{ id: "claude-opus-4-6" }],
        find: (provider: string, id: string) =>
          provider === "anthropic" && id === "claude-opus-4-6" ? { id: "claude-opus-4-6" } : undefined,
      },
    };

    it("accepts a valid model id", () => {
      const entry = findEntry("smart")!;
      expect(() => entry.validator!("claude-opus-4-6", mockCtx)).not.toThrow();
    });

    it("rejects unknown model id", () => {
      const entry = findEntry("smart")!;
      expect(() => entry.validator!("nonexistent", mockCtx)).toThrow("Model not found in registry");
    });

    it("accepts provider-qualified model", () => {
      const entry = findEntry("smart")!;
      expect(() => entry.validator!("anthropic/claude-opus-4-6", mockCtx)).not.toThrow();
    });

    it("rejects unknown provider-qualified model", () => {
      const entry = findEntry("smart")!;
      expect(() => entry.validator!("fake/nonexistent", mockCtx)).toThrow("Model not found in registry");
    });

    it("rejects empty value", () => {
      const entry = findEntry("smart")!;
      expect(() => entry.validator!("", mockCtx)).toThrow("Model value cannot be empty");
    });
  });
});
