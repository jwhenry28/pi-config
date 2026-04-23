import { describe, it, expect, afterEach } from "vitest";
import { createComponentTest, type ComponentTestSession } from "../../testutils/component/index.js";

describe("timer extension (component)", () => {
  let test: ComponentTestSession | undefined;

  afterEach(() => {
    test?.dispose();
    test = undefined;
  });

  it("/timer help shows usage", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/timer help");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("Usage:") })
    );
  });

  it("/timer with no args shows help", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/timer");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("Usage:") })
    );
  });

  it("/timer set creates a timer", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/timer set 5m Check the build");

    const setNotif = test.notifications.find(
      (n) => n.message.includes("5m") && n.message.includes("Check the build")
    );
    expect(setNotif).toBeDefined();
  });

  it("/timer set --recurring creates a recurring timer", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/timer set 2h --recurring Review status");

    const setNotif = test.notifications.find(
      (n) => n.message.includes("recurring") && n.message.includes("2h")
    );
    expect(setNotif).toBeDefined();
  });

  it("/timer set with invalid duration shows error", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/timer set abc Do stuff");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("Invalid duration") })
    );
  });

  it("/timer list shows 'no active timers' when empty", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/timer list");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("No active timers") })
    );
  });

  it("/timer list shows active timers after set", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/timer set 5m My task");
    test.sendUserMessage("/timer list");

    const listNotif = test.notifications.find(
      (n) => n.message.includes("My task") && n.message.includes("Active timers")
    );
    expect(listNotif).toBeDefined();
  });

  it("/timer cancel removes a timer", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/timer set 5m Task to cancel");

    // Extract the ID from the notification
    const setNotif = test.notifications.find((n) => n.message.includes("Task to cancel"));
    const id = setNotif?.message.match(/([0-9a-f]{6})/)?.[1];
    expect(id).toBeDefined();

    test.sendUserMessage(`/timer cancel ${id}`);

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("Cancelled") })
    );

    // Verify it's gone from list
    test.sendUserMessage("/timer list");
    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("No active timers") })
    );
  });

  it("/timer cancel with unknown ID shows error", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/timer cancel ffffff");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("not found") })
    );
  });

  it("unknown subcommand shows warning", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/timer bogus");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining("Unknown subcommand") })
    );
  });

  it("set_timer tool creates a timer and returns confirmation", async () => {
    test = await createComponentTest({ shownModules: ["timer"] });

    const result = await test.invokeTool("set_timer", {
      duration: "5m",
      prompt: "Check the build",
      recurring: false,
    });

    expect(result.isError).toBe(false);
    expect(JSON.stringify(result.result)).toContain("5m");
    expect(JSON.stringify(result.result)).toContain("Check the build");
  });

  it("set_timer tool with invalid duration returns error", async () => {
    test = await createComponentTest({ shownModules: ["timer"] });

    const result = await test.invokeTool("set_timer", {
      duration: "abc",
      prompt: "Do stuff",
      recurring: false,
    });

    expect(result.isError).toBe(false);
    expect(JSON.stringify(result.result)).toContain("Invalid duration");
  });
});
