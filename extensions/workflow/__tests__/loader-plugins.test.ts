import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setHomeDirOverride, clearHomeDirOverride, getPluginsDir } from "../../shared/home.js";
import { setEnabledPlugins } from "../../shared/plugins.js";
import { listWorkflows, loadWorkflowFile, validate } from "../loader.js";
import { purgeStore } from "../../testutils/index.js";
import { writeGlobalPluginDir, writePrompt } from "../../testutils/fixtures.js";
import type { WorkflowConfig, PromptStep } from "../types.js";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

const cwd = process.cwd();
let tmpHome: string;

describe("workflow loader — plugin repos", () => {
  beforeEach(() => {
    tmpHome = join(cwd, ".test-home-" + Date.now());
    mkdirSync(tmpHome, { recursive: true });
    setHomeDirOverride(tmpHome);
  });

  afterEach(() => {
    clearHomeDirOverride();
    if (existsSync(tmpHome)) rmSync(tmpHome, { recursive: true, force: true });
    purgeStore(cwd, "pi-config");
  });

  describe("listWorkflows", () => {
    it("includes namespaced plugin workflows", () => {
      writeGlobalPluginDir("my-repo", {
        workflows: [{ name: "deploy", config: { name: "deploy", steps: [{ name: "step1", prompt: "do stuff", model: "anthropic:claude-sonnet-4-20250514" }] } }],
      });

      setEnabledPlugins(cwd, ["my-repo"]);
      const workflows = listWorkflows(cwd);

      expect(workflows).toContain("my-repo:deploy");
    });

    it("does not include workflows from disabled plugins", () => {
      writeGlobalPluginDir("disabled-repo", {
        workflows: [{ name: "deploy", config: { name: "deploy", steps: [{ name: "step1", prompt: "do stuff", model: "anthropic:claude-sonnet-4-20250514" }] } }],
      });

      const workflows = listWorkflows(cwd);
      expect(workflows).not.toContain("disabled-repo:deploy");
    });
  });

  describe("loadWorkflowFile", () => {
    it("loads a namespaced plugin workflow", () => {
      writeGlobalPluginDir("my-repo", {
        workflows: [{ name: "deploy", config: { name: "deploy", steps: [{ name: "Build", prompt: "Build the project", model: "anthropic:claude-sonnet-4-20250514" }] } }],
      });

      setEnabledPlugins(cwd, ["my-repo"]);
      const config = loadWorkflowFile("my-repo:deploy", cwd);

      expect(config.name).toBe("deploy");
      expect(config.steps).toHaveLength(1);
    });

    it("throws for plugin workflow that doesn't exist", () => {
      setEnabledPlugins(cwd, ["my-repo"]);
      expect(() => loadWorkflowFile("my-repo:nonexistent", cwd)).toThrow();
    });
  });

  describe("plugin skill ref validation", () => {
    function makeConfig(skills: string[]): WorkflowConfig {
      return {
        name: "test",
        steps: [{
          name: "Step1",
          prompt: "do stuff",
          model: "anthropic/claude-sonnet-4-20250514",
          skills,
          maxExecutions: 10,
        } satisfies PromptStep],
      };
    }

    const mockCtx = {
      modelRegistry: {
        getAll: () => [],
        find: () => ({}),
      },
    } as unknown as ExtensionContext;

    it("passes validation when plugin skill path exists with SKILL.md", () => {
      writeGlobalPluginDir("my-repo", {
        skills: [{ name: "my-skill", content: "---\nname: my-skill\ndescription: test\n---\n# My Skill" }],
      });

      const result = validate(makeConfig(["my-repo/skills/my-skill"]), cwd, [], mockCtx);
      expect(result).toBeNull();
    });

    it("errors when plugin repo does not exist", () => {
      const result = validate(makeConfig(["nonexistent-repo/skills/my-skill"]), cwd, [], mockCtx);
      expect(result).toMatch(/Plugin repo "nonexistent-repo" not found/);
    });

    it("errors when plugin skill directory does not exist", () => {
      writeGlobalPluginDir("my-repo");

      const result = validate(makeConfig(["my-repo/skills/nonexistent"]), cwd, [], mockCtx);
      expect(result).toMatch(/Plugin skill path not found/);
    });

    it("errors when SKILL.md is missing from plugin skill directory", () => {
      writeGlobalPluginDir("my-repo", {
        files: [{ path: "skills/no-skillmd/.keep", content: "" }],
      });

      const result = validate(makeConfig(["my-repo/skills/no-skillmd"]), cwd, [], mockCtx);
      expect(result).toMatch(/Plugin skill has no SKILL.md/);
    });
  });

  describe("prompt resolution validation errors", () => {
    const mockCtx = {
      modelRegistry: {
        getAll: () => [],
        find: () => ({}),
      },
    } as unknown as ExtensionContext;

    it("includes resolver ambiguity details for step prompts", () => {
      const testCwd = mkdtempSync(join(tmpdir(), "workflow-loader-cwd-"));
      const head = `pack-${Date.now()}`;
      const nestedRef = `${head}/task`;

      writePrompt(testCwd, `${head}/task`, "LOCAL");
      writePrompt(tmpHome, `${head}/task`, "HOME");

      const config: WorkflowConfig = {
        name: "test",
        steps: [{
          name: "Step1",
          prompt: `@${nestedRef}`,
          model: "anthropic/claude-sonnet-4-20250514",
          maxExecutions: 10,
        } satisfies PromptStep],
      };

      const result = validate(config, testCwd, [], mockCtx);
      expect(result).toMatch(/Prompt file resolution failed/);
      expect(result).toMatch(/Ambiguous prompt reference/);
      expect(result).toMatch(new RegExp(head));

      rmSync(testCwd, { recursive: true, force: true });
    });
  });
});
