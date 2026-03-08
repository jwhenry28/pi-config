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

  it("/plugin module help shows usage", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
    });
    test.sendUserMessage("/plugin module help");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Usage: /plugin module"),
      })
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
      })
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
      })
    );
  });

  it("/plugin module show on nonexistent module shows error", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
    });
    test.sendUserMessage("/plugin module show nonexistent");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("not found"),
        type: "error",
      })
    );
  });

  it("/plugin module list <name> shows module contents", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
      shownModules: ["test-mod"],
    });
    test.sendUserMessage("/plugin module list test-mod");

    const detailNotif = test.notifications.find(n =>
      n.message.includes("test-mod") && n.message.includes("Skills")
    );
    expect(detailNotif).toBeDefined();
    expect(detailNotif!.message).toContain("test-mod-skill");
  });

  // ── Skill filtering from system prompt ─────────────────────────

  it("hiding a module strips its skills from the LLM system prompt", async () => {
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

    test.sendUserMessage("hello shown");
    await test.mockAgentResponse({ text: "hi" });
    await test.waitForIdle();

    const shownContext = capturedContexts[0];
    expect(shownContext.systemPrompt).toContain("test-mod-skill");

    test.sendUserMessage("/plugin module hide test-mod");
    capturedContexts = [];

    test.sendUserMessage("hello hidden");
    await test.mockAgentResponse({ text: "hi" });
    await test.waitForIdle();

    const hiddenContext = capturedContexts[0];
    expect(hiddenContext.systemPrompt).not.toContain("test-mod-skill");
  });

  it("/plugin module hide on already-hidden module warns", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
    });
    test.sendUserMessage("/plugin module hide test-mod");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("is not shown"),
        type: "warning",
      })
    );
  });

  it("/plugin module show on already-shown module warns", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
      shownModules: ["test-mod"],
    });
    test.sendUserMessage("/plugin module show test-mod");

    expect(test.notifications).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("already shown"),
        type: "warning",
      })
    );
  });

  it("showing a module restores its skills in the LLM system prompt", async () => {
    test = await createComponentTest({
      initialSkills: [{ name: "test-mod-skill", content: SKILL_CONTENT }],
    });

    let capturedContexts: any[] = [];
    const originalStreamFn = test.session.agent.streamFn;
    test.session.agent.streamFn = (model: any, context: any, options?: any) => {
      capturedContexts.push(context);
      return originalStreamFn(model, context, options);
    };

    test.sendUserMessage("hello hidden");
    await test.mockAgentResponse({ text: "hi" });
    await test.waitForIdle();

    const hiddenContext = capturedContexts[0];
    expect(hiddenContext.systemPrompt).not.toContain("test-mod-skill");

    test.sendUserMessage("/plugin module show test-mod");
    capturedContexts = [];

    test.sendUserMessage("hello shown");
    await test.mockAgentResponse({ text: "hi" });
    await test.waitForIdle();

    const shownContext = capturedContexts[0];
    expect(shownContext.systemPrompt).toContain("test-mod-skill");
  });
});
