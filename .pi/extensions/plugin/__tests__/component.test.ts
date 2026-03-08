import { describe, it, expect, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createComponentTest, writeGlobalPluginDir, writeWrapper, writeWorkflow, type ComponentTestSession } from "../../testutils/component/index.js";
import { WRAPPER_SKILLS_DIR, WORKFLOWS_DIR } from "../../shared/paths.js";
import { getPluginsDir } from "../../shared/home.js";

describe("/plugin component tests", () => {
  let test: ComponentTestSession;

  afterEach(() => {
    test?.dispose();
  });

  async function createTest() {
    test = await createComponentTest();
    return test;
  }

  describe("help and dispatch", () => {
    it("/plugin shows help", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin");
      await t.waitForIdle();
      expect(t.notifications).toHaveLength(1);
      expect(t.notifications[0].message).toContain("Usage: /plugin");
    });

    it("/plugin help shows help", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin help");
      await t.waitForIdle();
      expect(t.notifications[0].message).toContain("Usage: /plugin");
    });

    it("unknown subcommand warns", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin bogus");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("warning");
      expect(t.notifications[0].message).toContain("Unknown subcommand");
    });

    it("unknown repo action warns", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin repo bogus");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("warning");
    });

    it("unknown skill action warns", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin skill bogus");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("warning");
    });

    it("unknown workflow action warns", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin workflow bogus");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("warning");
    });

  });

  describe("repo commands — argument validation", () => {
    it("/plugin repo download without URL warns", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin repo download");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("warning");
      expect(t.notifications[0].message).toContain("Usage");
    });

    it("/plugin repo update without name updates all (empty = no plugins)", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin repo update");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("info");
      expect(t.notifications[0].message).toContain("No plugins found");
    });

    it("/plugin repo remove without name warns", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin repo remove");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("warning");
      expect(t.notifications[0].message).toContain("Usage");
    });

    it("/plugin repo remove nonexistent errors", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin repo remove nonexistent");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("error");
      expect(t.notifications[0].message).toContain("not found");
    });

    it("/plugin repo remove deletes clean repo", async () => {
      const t = await createTest();
      writeGlobalPluginDir("test-repo", [{ path: "README.md", content: "# test" }]);

      t.sendUserMessage("/plugin repo remove test-repo");
      await t.waitForIdle();

      expect(t.notifications[0].type).toBe("info");
      expect(t.notifications[0].message).toContain('Removed repo "test-repo"');
      const pluginDir = join(getPluginsDir(), "test-repo");
      expect(existsSync(pluginDir)).toBe(false);
    });
  });

  describe("skill add/remove", () => {
    it("/plugin skill add without path warns", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin skill add");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("warning");
      expect(t.notifications[0].message).toContain("Usage");
    });

    it("/plugin skill add creates WRAPPER.md", async () => {
      const t = await createTest();
      writeGlobalPluginDir("test-repo", [{ path: "my-skill/SKILL.md", content: "# My Skill" }]);

      t.sendUserMessage("/plugin skill add test-repo/my-skill");
      await t.waitForIdle();

      expect(t.notifications[0].type).toBe("info");
      expect(t.notifications[0].message).toContain("my-skill");

      const wrapperPath = join(t.cwd, WRAPPER_SKILLS_DIR, "my-skill", "WRAPPER.md");
      expect(existsSync(wrapperPath)).toBe(true);
      const content = readFileSync(wrapperPath, "utf-8");
      expect(content).toContain("test-repo/my-skill");
    });

    it("/plugin skill remove deletes WRAPPER.md", async () => {
      const t = await createTest();
      writeWrapper(t.cwd, "my-skill", "@/test-repo/my-skill");

      t.sendUserMessage("/plugin skill remove my-skill");
      await t.waitForIdle();

      expect(t.notifications[0].type).toBe("info");
      expect(t.notifications[0].message).toContain("Removed");
      const skillDir = join(t.cwd, WRAPPER_SKILLS_DIR, "my-skill");
      expect(existsSync(skillDir)).toBe(false);
    });

    it("/plugin skill remove nonexistent errors", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin skill remove nonexistent");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("error");
    });
  });

  describe("workflow add/remove", () => {
    it("/plugin workflow add without name warns", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin workflow add");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("warning");
      expect(t.notifications[0].message).toContain("Usage");
    });

    it("/plugin workflow add copies yml from plugin repo", async () => {
      const t = await createTest();
      writeGlobalPluginDir("wf-repo", [{ path: "workflows/deploy.yml", content: "name: deploy\nsteps: []" }]);

      t.sendUserMessage("/plugin workflow add deploy");
      await t.waitForIdle();

      expect(t.notifications[0].type).toBe("info");
      expect(t.notifications[0].message).toContain("deploy");

      const destPath = join(t.cwd, WORKFLOWS_DIR, "deploy.yml");
      expect(existsSync(destPath)).toBe(true);
      expect(readFileSync(destPath, "utf-8")).toContain("name: deploy");
    });

    it("/plugin workflow add errors if workflow already exists locally", async () => {
      const t = await createTest();
      writeGlobalPluginDir("wf-repo2", [{ path: "workflows/existing.yml", content: "name: existing" }]);
      writeWorkflow(t.cwd, "existing", { name: "existing", steps: [] });

      t.sendUserMessage("/plugin workflow add existing");
      await t.waitForIdle();

      expect(t.notifications[0].type).toBe("error");
      expect(t.notifications[0].message).toContain("already exists");
    });

    it("/plugin workflow add errors if not found in any repo", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin workflow add nonexistent");
      await t.waitForIdle();

      expect(t.notifications[0].type).toBe("error");
      expect(t.notifications[0].message).toContain("not found");
    });

    it("/plugin workflow remove deletes workflow file", async () => {
      const t = await createTest();
      writeWorkflow(t.cwd, "my-flow", { name: "my-flow", steps: [] });

      t.sendUserMessage("/plugin workflow remove my-flow");
      await t.waitForIdle();

      expect(t.notifications[0].type).toBe("info");
      expect(t.notifications[0].message).toContain("Removed");
      expect(existsSync(join(t.cwd, WORKFLOWS_DIR, "my-flow.yml"))).toBe(false);
    });

    it("/plugin workflow remove nonexistent errors", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin workflow remove ghost");
      await t.waitForIdle();

      expect(t.notifications[0].type).toBe("error");
      expect(t.notifications[0].message).toContain("not found");
    });
  });

  describe("skill tag", () => {
    it("/plugin skill tag without args warns", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin skill tag");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("warning");
      expect(t.notifications[0].message).toContain("Usage");
    });

    it("/plugin skill tag sets module on WRAPPER.md", async () => {
      const t = await createTest();
      writeWrapper(t.cwd, "tag-comp-test", "@/repo/sk");

      t.sendUserMessage("/plugin skill tag tag-comp-test my-module");
      await t.waitForIdle();

      expect(t.notifications[0].type).toBe("info");
      expect(t.notifications[0].message).toContain("Tagged");
      const skillDir = join(t.cwd, WRAPPER_SKILLS_DIR, "tag-comp-test");
      const content = readFileSync(join(skillDir, "WRAPPER.md"), "utf-8");
      expect(content).toContain("module: my-module");
    });

    it("/plugin skill tag nonexistent errors", async () => {
      const t = await createTest();
      t.sendUserMessage("/plugin skill tag nonexistent mod");
      await t.waitForIdle();
      expect(t.notifications[0].type).toBe("error");
      expect(t.notifications[0].message).toContain("not found");
    });
  });


});
