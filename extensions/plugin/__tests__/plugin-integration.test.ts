import { describe, it, expect, afterEach } from "vitest";
import { createComponentTest, type ComponentTestSession } from "../../testutils/component/index.js";

describe("plugin extension (integration)", () => {
  let test: ComponentTestSession | undefined;

  afterEach(() => {
    test?.dispose();
    test = undefined;
  });

  it("/plugin help shows repo subcommands", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/plugin help");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("download"),
      }),
    );
    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("enable"),
      }),
    );
  });

  it("/plugin with no args shows help", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/plugin");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Usage: /plugin"),
      }),
    );
  });

  it("unknown /plugin subcommand shows warning", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/plugin bogus");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Unknown subcommand"),
        type: "warning",
      }),
    );
  });
});
