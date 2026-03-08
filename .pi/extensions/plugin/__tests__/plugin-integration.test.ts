import { describe, it, expect, afterEach } from "vitest";
import { createComponentTest, type ComponentTestSession } from "../../testutils/component/index.js";

const SKILL_CONTENT = [
  "---",
  "name: test-mod-skill",
  "description: Test skill for module tests",
  "module: test-mod",
  "---",
  "# Test Skill",
  "Test content for module filtering.",
].join("\n");

describe("plugin extension (integration)", () => {
  let test: ComponentTestSession | undefined;

  afterEach(() => {
    test?.dispose();
    test = undefined;
  });

  it("/plugin help includes module subcommands", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/plugin help");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("module show"),
      }),
    );
    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("module hide"),
      }),
    );
  });

  it("/plugin module help shows module-specific usage", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/plugin module help");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Usage: /plugin module"),
      }),
    );
  });

  it("/plugin module show activates a module", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
    });
    test.sendUserMessage("/plugin module show test-mod");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Shown module"),
      }),
    );
  });

  it("/plugin module hide deactivates a module", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
      shownModules: ["test-mod"],
    });
    test.sendUserMessage("/plugin module hide test-mod");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Hidden module"),
      }),
    );
  });

  it("/plugin module list <name> shows module contents", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
      shownModules: ["test-mod"],
    });
    test.sendUserMessage("/plugin module list test-mod");

    const detailNotif = test.notifications.find(
      (n) => n.message.includes("test-mod") && n.message.includes("Skills"),
    );
    expect(detailNotif).toBeDefined();
    expect(detailNotif!.message).toContain("test-mod-skill");
  });

  it("unknown /plugin subcommand group shows warning", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/plugin bogus");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Unknown subcommand group"),
        type: "warning",
      }),
    );
  });

  it("/plugin module with no action shows usage", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/plugin module");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Usage: /plugin module"),
      }),
    );
  });
});
