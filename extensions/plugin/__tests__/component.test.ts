import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createComponentTest, writeGlobalPluginDir, type ComponentTestSession } from "../../testutils/component/index.js";
import { getEnabledPlugins } from "../../shared/plugins.js";
import { purgeStore } from "../../testutils/index.js";

describe("/plugin component tests", () => {
  let t: ComponentTestSession | undefined;

  afterEach(() => {
    t?.dispose();
    t = undefined;
  });

  it("/plugin shows help", async () => {
    t = await createComponentTest();
    t.sendUserMessage("/plugin");

    expect(t.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Usage: /plugin"),
      }),
    );
  });

  it("/plugin help shows help", async () => {
    t = await createComponentTest();
    t.sendUserMessage("/plugin help");

    expect(t.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("enable"),
      }),
    );
  });

  it("/plugin bogus warns", async () => {
    t = await createComponentTest();
    t.sendUserMessage("/plugin bogus");

    expect(t.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Unknown subcommand"),
        type: "warning",
      }),
    );
  });

  it("/plugin enable without name warns", async () => {
    t = await createComponentTest();
    t.sendUserMessage("/plugin enable");

    expect(t.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Usage"),
        type: "warning",
      }),
    );
  });

  it("/plugin disable without name warns", async () => {
    t = await createComponentTest();
    t.sendUserMessage("/plugin disable");

    expect(t.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Usage"),
        type: "warning",
      }),
    );
  });

  it("/plugin enable nonexistent errors", async () => {
    t = await createComponentTest();
    t.sendUserMessage("/plugin enable nonexistent");

    expect(t.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("not found"),
        type: "error",
      }),
    );
  });

  it("/plugin enable <name> enables a plugin", async () => {
    t = await createComponentTest({
      initialPlugins: [{ name: "test-repo", files: [{ path: "skills/my-skill/SKILL.md", content: "---\nname: my-skill\ndescription: test\n---\n# Test" }] }],
    });
    t.sendUserMessage("/plugin enable test-repo");

    expect(t.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Enabled"),
      }),
    );
    expect(getEnabledPlugins(t.cwd)).toContain("test-repo");
  });

  it("/plugin disable <name> disables an enabled plugin", async () => {
    t = await createComponentTest({
      initialPlugins: [{ name: "test-repo", files: [{ path: "skills/my-skill/SKILL.md", content: "---\nname: my-skill\ndescription: test\n---\n# Test" }] }],
    });
    t.sendUserMessage("/plugin enable test-repo");
    t.sendUserMessage("/plugin disable test-repo");

    expect(t.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Disabled"),
      }),
    );
    expect(getEnabledPlugins(t.cwd)).not.toContain("test-repo");
  });

  it("/plugin disable nonexistent warns", async () => {
    t = await createComponentTest();
    t.sendUserMessage("/plugin disable nonexistent");

    expect(t.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("not enabled"),
        type: "warning",
      }),
    );
  });

  it("/plugin list with no repos shows no plugins", async () => {
    t = await createComponentTest();
    t.sendUserMessage("/plugin list");

    expect(t.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("No plugins found"),
        type: "info",
      }),
    );
  });

  it("/plugin list shows enabled/disabled status", async () => {
    t = await createComponentTest({
      initialPlugins: [
        { name: "alpha", files: [{ path: "README.md", content: "# alpha" }] },
        { name: "beta", files: [{ path: "README.md", content: "# beta" }] },
      ],
    });
    t.sendUserMessage("/plugin enable alpha");
    t.sendUserMessage("/plugin list");

    const listNotif = t.notifications.find((n) => n.message.includes("alpha") && n.message.includes("beta"));
    expect(listNotif).toBeDefined();
    expect(listNotif!.message).toContain("* alpha");
    expect(listNotif!.message).toContain("- beta");
  });

  it("/plugin list shows all disabled when none enabled", async () => {
    t = await createComponentTest({
      initialPlugins: [
        { name: "solo-repo", files: [{ path: "README.md", content: "# solo" }] },
      ],
    });
    t.sendUserMessage("/plugin list");

    const listNotif = t.notifications.find((n) => n.message.includes("solo-repo"));
    expect(listNotif).toBeDefined();
    expect(listNotif!.message).toContain("- solo-repo");
    expect(listNotif!.message).not.toContain("* solo-repo");
  });
});
