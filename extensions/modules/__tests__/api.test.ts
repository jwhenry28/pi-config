import { describe, it, expect } from "vitest";
import { moduleTag } from "../api.js";

describe("moduleTag", () => {
  it("emits module:tool-tag event and returns tool def unchanged", () => {
    const emitted: any[] = [];
    const fakePi = {
      events: {
        emit: (event: string, data: any) => { emitted.push({ event, data }); },
      },
    } as any;

    const toolDef = { name: "my-tool", description: "test" };
    const result = moduleTag(fakePi, "my-module", toolDef);

    expect(result).toBe(toolDef);
    expect(emitted).toEqual([{
      event: "module:tool-tag",
      data: { toolName: "my-tool", moduleName: "my-module" },
    }]);
  });
});
