import { describe, it, expect } from "vitest";
import { formatModulesBlock } from "../display.js";

describe("formatModulesBlock", () => {
  it("formats enabled items with * and disabled with -", () => {
    const items = [
      { name: "mod-a", enabled: true },
      { name: "mod-b", enabled: false },
    ];
    const result = formatModulesBlock(items);
    expect(result).toContain("* mod-a");
    expect(result).toContain("- mod-b");
    expect(result).toContain("[Modules]");
  });

  it("applies custom formatters", () => {
    const items = [{ name: "mod-a", enabled: true }];
    const result = formatModulesBlock(items, {
      formatHeader: (t) => `HEADER:${t}`,
      formatEnabledLine: (n) => `ENABLED:${n}`,
    });
    expect(result).toContain("HEADER:[Modules]");
    expect(result).toContain("ENABLED:mod-a");
  });
});
