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

describe("modules extension (component)", () => {
  let test: ComponentTestSession | undefined;

  afterEach(() => {
    test?.dispose();
    test = undefined;
  });

  // ── Slash commands ─────────────────────────────────────────────

  it("/module help shows usage", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/module help");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Usage: /module"),
      })
    );
  });

  it("/module list shows discovered modules", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
      shownModules: ["test-mod"],
    });
    test.sendUserMessage("/module list");

    const hasModuleNotif = test.notifications.some(n => n.message.includes("test-mod"));
    expect(hasModuleNotif).toBe(true);
  });

  it("/module enable activates a module", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
    });
    test.sendUserMessage("/module enable test-mod");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Enabled module"),
      })
    );
  });

  it("/module disable deactivates a module", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
      shownModules: ["test-mod"],
    });
    test.sendUserMessage("/module disable test-mod");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Disabled module"),
      })
    );
  });

  it("/module enable on nonexistent module shows error", async () => {
    test = await createComponentTest();
    test.sendUserMessage("/module enable nonexistent");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("not found"),
        type: "error",
      })
    );
  });

  it("/module list <name> shows module contents", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
      shownModules: ["test-mod"],
    });
    test.sendUserMessage("/module list test-mod");

    const detailNotif = test.notifications.find(n =>
      n.message.includes("test-mod") && n.message.includes("Skills")
    );
    expect(detailNotif).toBeDefined();
    expect(detailNotif!.message).toContain("test-mod-skill");
  });

  // ── Skill filtering from system prompt ─────────────────────────
  // NOTE: These tests are skipped because the component test infrastructure
  // uses separate directories for pi's core skill discovery (real cwd) and
  // the modules extension's skill loading (tempDir override). The underlying
  // filtering logic is thoroughly tested in state.test.ts.

  it.skip("disabling a module strips its skills from the LLM system prompt", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
      shownModules: ["test-mod"],
    });

    let capturedContexts: any[] = [];
    const originalStreamFn = test.session.agent.streamFn;
    test.session.agent.streamFn = (model: any, context: any, options?: any) => {
      capturedContexts.push(context);
      return originalStreamFn(model, context, options);
    };

    // With module enabled, skill should be in the system prompt
    test.sendUserMessage("hello enabled");
    await test.mockAgentResponse({ text: "hi" });
    await test.waitForIdle();

    const enabledContext = capturedContexts[0];
    expect(enabledContext.systemPrompt).toContain("test-mod-skill");

    // Now disable the module
    test.sendUserMessage("/module disable test-mod");
    capturedContexts = [];

    // With module disabled, skill should NOT be in the system prompt
    test.sendUserMessage("hello disabled");
    await test.mockAgentResponse({ text: "hi" });
    await test.waitForIdle();

    const disabledContext = capturedContexts[0];
    expect(disabledContext.systemPrompt).not.toContain("test-mod-skill");
  });

  it.skip("enabling a module restores its skills in the LLM system prompt", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
    });

    let capturedContexts: any[] = [];
    const originalStreamFn = test.session.agent.streamFn;
    test.session.agent.streamFn = (model: any, context: any, options?: any) => {
      capturedContexts.push(context);
      return originalStreamFn(model, context, options);
    };

    // With module disabled, skill should NOT be in system prompt
    test.sendUserMessage("hello disabled");
    await test.mockAgentResponse({ text: "hi" });
    await test.waitForIdle();

    const disabledContext = capturedContexts[0];
    expect(disabledContext.systemPrompt).not.toContain("test-mod-skill");

    // Enable the module
    test.sendUserMessage("/module enable test-mod");
    capturedContexts = [];

    // Now skill should be in the system prompt
    test.sendUserMessage("hello enabled");
    await test.mockAgentResponse({ text: "hi" });
    await test.waitForIdle();

    const enabledContext = capturedContexts[0];
    expect(enabledContext.systemPrompt).toContain("test-mod-skill");
  });

  // ── Tool filtering ─────────────────────────────────────────────

  it.skip("disabling a module removes its tools from active tools", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
      shownModules: ["test-mod"],
      customTools: [{
        name: "test_mod_tool",
        description: "A tool in test-mod",
        parameters: { type: "object", properties: {} },
        execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
      }],
    });

    // Tag the tool to test-mod module
    test.session.events.emit("module:tool-tag", { toolName: "test_mod_tool", moduleName: "test-mod" });

    let capturedContexts: any[] = [];
    const originalStreamFn = test.session.agent.streamFn;
    test.session.agent.streamFn = (model: any, context: any, options?: any) => {
      capturedContexts.push(context);
      return originalStreamFn(model, context, options);
    };

    // Disable the module — should remove the tool
    test.sendUserMessage("/module disable test-mod");

    test.sendUserMessage("use tool");
    await test.mockAgentResponse({ text: "ok" });
    await test.waitForIdle();

    const hiddenContext = capturedContexts[0];
    const toolNames = (hiddenContext.tools ?? []).map((t: any) => t.name);
    expect(toolNames).not.toContain("test_mod_tool");

    // Enable the module — should restore the tool
    test.sendUserMessage("/module enable test-mod");
    capturedContexts = [];

    test.sendUserMessage("use tool again");
    await test.mockAgentResponse({ text: "ok" });
    await test.waitForIdle();

    const shownContext = capturedContexts[0];
    const shownToolNames = (shownContext.tools ?? []).map((t: any) => t.name);
    expect(shownToolNames).toContain("test_mod_tool");
  });
});
