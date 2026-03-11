import { describe, it, expect, afterEach } from "vitest";
import { createComponentTest, writeConfigFile, type ComponentTestSession } from "../../testutils/component/index.js";

describe("/config component tests", () => {
  let test: ComponentTestSession;

  afterEach(() => {
    test?.dispose();
  });

  async function createTest() {
    test = await createComponentTest();
    return test;
  }

  describe("help", () => {
    it("/config shows usage help", async () => {
      const t = await createTest();
      t.sendUserMessage("/config");
      await t.waitForIdle();
      expect(t.notifications).toHaveLength(1);
      expect(t.notifications[0].message).toContain("Usage: /config");
    });

    it("/config help shows usage help", async () => {
      const t = await createTest();
      t.sendUserMessage("/config help");
      await t.waitForIdle();
      expect(t.notifications[0].message).toContain("Usage: /config");
    });
  });

  describe("list", () => {
    it("lists all config keys with defaults", async () => {
      const t = await createTest();
      t.sendUserMessage("/config list");
      await t.waitForIdle();
      expect(t.notifications[0].message).toContain("smart");
      expect(t.notifications[0].message).toContain("general");
      expect(t.notifications[0].message).toContain("fast");
    });
  });

  describe("get", () => {
    it("shows default when not set", async () => {
      const t = await createTest();
      t.sendUserMessage("/config get smart");
      await t.waitForIdle();
      expect(t.notifications[0].message).toContain("smart");
      expect(t.notifications[0].message).toContain("default");
    });

    it("warns on unknown key", async () => {
      const t = await createTest();
      t.sendUserMessage("/config get nonexistent");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("warning");
      expect(t.notifications[0].message).toContain("Unknown config key");
    });

    it("shows usage when no name given", async () => {
      const t = await createTest();
      t.sendUserMessage("/config get");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("warning");
      expect(t.notifications[0].message).toContain("Usage");
    });
  });

  describe("set", () => {
    it("shows usage when no args given", async () => {
      const t = await createTest();
      t.sendUserMessage("/config set");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("warning");
    });

    it("warns on unknown key", async () => {
      const t = await createTest();
      t.sendUserMessage("/config set nonexistent value");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("warning");
      expect(t.notifications[0].message).toContain("Unknown config key");
    });
  });

  describe("apply", () => {
    it("applies a config file", async () => {
      const t = await createTest();
      writeConfigFile(t.cwd, "test.yml", [
        "name: Test",
        "configs:",
        "  - name: smart",
        "    value: claude-opus-4-6",
      ].join("\n"));

      t.sendUserMessage("/config apply test");
      await t.waitForIdle();
      expect(t.notifications[0].message).toContain("Applied config: Test");
      expect(t.notifications[0].type).toBe("info");
    });

    it("shows error for missing config file", async () => {
      const t = await createTest();
      t.sendUserMessage("/config apply missing");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("error");
    });

    it("shows usage when no name given", async () => {
      const t = await createTest();
      t.sendUserMessage("/config apply");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("warning");
    });
  });

  describe("unknown subcommand", () => {
    it("warns on unknown subcommand", async () => {
      const t = await createTest();
      t.sendUserMessage("/config bogus");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("warning");
      expect(t.notifications[0].message).toContain("Unknown subcommand: bogus");
    });
  });

  describe("set then get", () => {
    it("get returns value after set", async () => {
      const t = await createTest();
      await t.runCommand("/config set smart claude-opus-4-6");
      t.notifications.length = 0;

      await t.runCommand("/config get smart");
      expect(t.notifications[0].message).toContain("claude-opus-4-6");
      expect(t.notifications[0].message).not.toContain("default");
    });
  });
});
