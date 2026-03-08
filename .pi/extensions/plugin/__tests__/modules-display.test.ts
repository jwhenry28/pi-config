import { describe, it, expect } from "vitest";
import { formatModulesBlock } from "../modules/display.js";

describe("formatModulesBlock", () => {
  it("formats shown items with * and hidden with -", () => {
    const items = [
      { name: "mod-a", shown: true },
      { name: "mod-b", shown: false },
    ];
    const result = formatModulesBlock(items);
    expect(result).toContain("* mod-a");
    expect(result).toContain("- mod-b");
    expect(result).toContain("[Modules]");
  });

  it("applies custom formatters", () => {
    const items = [{ name: "mod-a", shown: true }];
    const result = formatModulesBlock(items, {
      formatHeader: (t) => `HEADER:${t}`,
      formatShownLine: (n) => `SHOWN:${n}`,
    });
    expect(result).toContain("HEADER:[Modules]");
    expect(result).toContain("SHOWN:mod-a");
  });
});
