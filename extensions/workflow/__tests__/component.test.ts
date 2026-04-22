import { deleteEntry, readKey, writeKey } from "../../memory/store.js";
import { describe, it, expect, afterEach } from "vitest";
import { createComponentTest, type ComponentTestSession } from "../../testutils/component/index.js";
import { writeWorkflow, writeTodo, writeFile } from "../../testutils/component/index.js";
import { registerMockModel, runWorkflow, installConditionOverride, parseWorkflowId } from "./helpers.js";
import { setConditionStreamFnOverride } from "../evaluator.js";
import { computeEffectiveModules } from "../runner.js";
import { resolveModelAlias } from "../models.js";

describe("workflow extension (component)", () => {
  let test: ComponentTestSession | undefined;
  afterEach(() => {
    setConditionStreamFnOverride(undefined);
    test?.dispose();
    test = undefined;
  });

  describe("workflow prompt memory", () => {
    it("stores the initial workflow prompt under workflow-prompt on start", async () => {
      test = await createComponentTest({ shownModules: ["memory"] });
      registerMockModel(test);

      writeWorkflow(test.cwd, "prompt-start", {
        name: "prompt-start",
        steps: [{ name: "Step1", model: "mock-model", prompt: "Do work", approval: true }],
      });

      test.sendUserMessage("/workflow prompt-start Original canonical prompt");
      await test.mockAgentResponse({ text: "Done" });
      await new Promise(r => setTimeout(r, 300));

      const workflowId = parseWorkflowId(test.events);
      expect(readKey(test.cwd, workflowId, "workflow-prompt")).toBe("Original canonical prompt");
    }, 15000);

    it("fails clearly when workflow-prompt is missing before a later step", async () => {
      test = await createComponentTest({ shownModules: ["memory"] });
      registerMockModel(test);

      writeWorkflow(test.cwd, "prompt-missing", {
        name: "prompt-missing",
        steps: [
          { name: "Step1", model: "mock-model", prompt: "First", approval: true },
          { name: "Step2", model: "mock-model", prompt: "Second" },
        ],
      });

      test.sendUserMessage("/workflow prompt-missing Original prompt text");
      await test.mockAgentResponse({ text: "Finished step 1" });
      await test.waitForIdle();

      const workflowId = parseWorkflowId(test.events);
      deleteEntry(test.cwd, workflowId, "workflow-prompt");

      test.sendUserMessage("/workflow continue");
      await new Promise(r => setTimeout(r, 300));

      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("Missing workflow prompt in memory"),
        })
      );
    }, 15000);
  });

  describe("prompt memory between steps", () => {
    it("uses updated workflow-prompt memory value for the next step", async () => {
      test = await createComponentTest({ shownModules: ["memory"] });
      registerMockModel(test);

      writeWorkflow(test.cwd, "prompt-revision", {
        name: "prompt-revision",
        steps: [
          { name: "Brainstorm", model: "mock-model", prompt: "Brainstorm work", approval: true },
          { name: "Implement", model: "mock-model", prompt: "Implement work" },
        ],
      });

      const capturedContexts: any[] = [];
      const originalStreamFn = test.session.agent.streamFn;
      test.session.agent.streamFn = (model: any, context: any, options?: any) => {
        capturedContexts.push(JSON.parse(JSON.stringify(context)));
        return originalStreamFn(model, context, options);
      };

      test.sendUserMessage("/workflow prompt-revision Build X using the old approach");
      await test.mockAgentResponse({ text: "We discovered the better approach." });
      await test.waitForIdle();

      const workflowId = parseWorkflowId(test.events);
      writeKey(test.cwd, workflowId, "workflow-prompt", "Build X using the revised approach");

      test.sendUserMessage("/workflow continue");
      await new Promise(r => setTimeout(r, 300));
      await test.mockAgentResponse({ text: "Implemented the revised approach." });
      await test.waitForIdle();

      const step2Text = JSON.stringify(capturedContexts[1].messages);
      expect(step2Text).toContain("Build X using the revised approach");
      expect(step2Text).not.toContain("Build X using the old approach");
    }, 15000);
  });

  describe("basic multi-step", () => {
    it("runs all steps in order and completes", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeWorkflow(test.cwd, "basic-test", {
        name: "basic-test",
        steps: [
          { name: "Step1", model: "mock-model", prompt: "Do step 1" },
          { name: "Step2", model: "mock-model", prompt: "Do step 2" },
          { name: "Step3", model: "mock-model", prompt: "Do step 3" },
        ],
      });

      await runWorkflow(test, "/workflow basic-test Run this workflow", 3);

      const markers = test.events.customMessages("workflow:step-marker");
      expect(markers).toHaveLength(3);
      expect(markers[0].details.stepName).toBe("Step1");
      expect(markers[1].details.stepName).toBe("Step2");
      expect(markers[2].details.stepName).toBe("Step3");

      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Workflow "basic-test" complete!'),
        })
      );
    }, 15000);
  });

  describe("fresh context per step", () => {
    it("step 2 does not see step 1 agent response in LLM context", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeWorkflow(test.cwd, "context-iso", {
        name: "context-iso",
        steps: [
          { name: "First", model: "mock-model", prompt: "Do first thing" },
          { name: "Second", model: "mock-model", prompt: "Do second thing" },
        ],
      });

      // Capture contexts passed to streamFn
      const capturedContexts: any[] = [];
      const originalStreamFn = test.session.agent.streamFn;
      test.session.agent.streamFn = (model: any, context: any, options?: any) => {
        capturedContexts.push(JSON.parse(JSON.stringify(context)));
        return originalStreamFn(model, context, options);
      };

      await runWorkflow(test, "/workflow context-iso Check isolation", 2);

      // Should have 2 LLM calls (one per step)
      expect(capturedContexts.length).toBe(2);

      // Step 2's messages should NOT contain the step 1 response
      const step2Text = JSON.stringify(capturedContexts[1].messages);
      // Step 1 gets auto-responded with empty text, but verify the step 1
      // user message isn't in step 2's context either
      const step1Text = JSON.stringify(capturedContexts[0].messages);
      const step1UserMsg = capturedContexts[0].messages.find((m: any) => m.role === "user");
      if (step1UserMsg) {
        const step1Content = JSON.stringify(step1UserMsg.content);
        // The step 1 prompt should NOT appear in step 2's context
        // Step 2 should only see its own prompt
        expect(step2Text).not.toContain("Do first thing");
      }
    }, 15000);
  });

  describe("skills", () => {
    it("injects skill into step that declares it, not into other steps", async () => {
      test = await createComponentTest({
        initialSkills: [{ name: "test-skill", content: `---
name: test-skill
description: A test skill for workflow testing
---

# Test Skill

This is FAKE_SKILL_CONTENT_FOR_TESTING.
` }],
      });

      writeWorkflow(test.cwd, "skills-test", {
        name: "skills-test",
        steps: [
          { name: "WithSkill", model: "mock-model", prompt: "Do something", skills: ["test-skill"] },
          { name: "WithoutSkill", model: "mock-model", prompt: "Do something else" },
        ],
      });
      registerMockModel(test);

      await runWorkflow(test, "/workflow skills-test Test skills", 2);

      // Verify skill was injected for step 1 only
      const skillMessages = test.events.customMessages("workflow:skill");
      expect(skillMessages).toHaveLength(1);
      expect(skillMessages[0].details.skillName).toBe("test-skill");
      expect(skillMessages[0].content).toContain("FAKE_SKILL_CONTENT_FOR_TESTING");
    }, 15000);
  });

  describe("command conditions", () => {
    it("jumps back when todos incomplete, advances when complete", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      // Write todo.md with unchecked items
      writeTodo(test.cwd, "todo.md", [
        { text: "Task A", checked: false },
        { text: "Task B", checked: false },
      ]);

      writeWorkflow(test.cwd, "cond-test", {
        name: "cond-test",
        steps: [
          {
            name: "DoWork",
            model: "mock-model",
            prompt: "Check off items in todo.md",
            conditions: [
              { command: "check-todos-complete", args: { todoFilepath: "todo.md" }, jump: "DoWork" },
            ],
          },
          { name: "Done", model: "mock-model", prompt: "Summarize" },
        ],
      });

      // Use sendUserMessage for precise control over each response
      test.sendUserMessage("/workflow cond-test Fix todos");

      // DoWork execution 1: todos still all unchecked → condition true → jump back
      await test.mockAgentResponse({ text: "Working on tasks" });
      // Condition evaluates: todos incomplete → jumps back to DoWork
      // Wait for jump + next step to start
      await new Promise(r => setTimeout(r, 200));

      // Before execution 2 response, mark one done
      writeTodo(test.cwd, "todo.md", [
        { text: "Task A", checked: true },
        { text: "Task B", checked: false },
      ]);

      // DoWork execution 2: still incomplete → jump back
      await test.mockAgentResponse({ text: "Checked off task A" });
      await new Promise(r => setTimeout(r, 200));

      // Before execution 3 response, mark all complete
      writeTodo(test.cwd, "todo.md", [
        { text: "Task A", checked: true },
        { text: "Task B", checked: true },
      ]);

      // DoWork execution 3: all complete → condition false → advance to Done
      await test.mockAgentResponse({ text: "All done" });
      await new Promise(r => setTimeout(r, 200));

      // Done step
      await test.mockAgentResponse({ text: "Summary complete" });
      await test.waitForIdle();
      await new Promise(r => setTimeout(r, 200));

      // Verify step markers
      const markers = test.events.customMessages("workflow:step-marker");
      expect(markers.length).toBeGreaterThanOrEqual(4);
      expect(markers[0].details.stepName).toBe("DoWork");
      expect(markers[0].details.execution).toBe(1);
      expect(markers[1].details.stepName).toBe("DoWork");
      expect(markers[1].details.execution).toBe(2);
      expect(markers[2].details.stepName).toBe("DoWork");
      expect(markers[2].details.execution).toBe(3);
      expect(markers[3].details.stepName).toBe("Done");

      // Verify condition results
      const condResults = test.events.customMessages("workflow:condition-result");
      expect(condResults.length).toBeGreaterThanOrEqual(3);

      // Verify completion
      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('complete!'),
        })
      );
    }, 30000);
  });

  describe("prompt conditions", () => {
    afterEach(() => {
      setConditionStreamFnOverride(undefined);
    });

    it("prompt condition evaluates true and jumps, then false and advances", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeWorkflow(test.cwd, "prompt-cond", {
        name: "prompt-cond",
        steps: [
          {
            name: "Check",
            model: "mock-model",
            prompt: "Do work",
            conditions: [
              { prompt: "Is there more work?", model: "mock-model", jump: "Check" },
            ],
            maxExecutions: 3,
          },
          { name: "Finish", model: "mock-model", prompt: "Wrap up" },
        ],
      });

      const { getCallCount } = installConditionOverride((callIndex) =>
        callIndex <= 1
          ? { result: "true", explanation: "More work needed" }
          : { result: "false", explanation: "All done" }
      );

      test.sendUserMessage("/workflow prompt-cond Test prompt conditions");

      // Execution 1 → condition true → jump back
      await test.mockAgentResponse({ text: "First pass" });
      await new Promise(r => setTimeout(r, 2000));
      // Execution 2 → condition false → advance to Finish
      await test.mockAgentResponse({ text: "Second pass" });
      await new Promise(r => setTimeout(r, 2000));
      // Finish step
      await test.mockAgentResponse({ text: "Wrapped up" });
      await test.waitForIdle();
      await new Promise(r => setTimeout(r, 200));

      const markers = test.events.customMessages("workflow:step-marker");
      expect(markers[0].details.stepName).toBe("Check");
      expect(markers[0].details.execution).toBe(1);
      expect(markers[1].details.stepName).toBe("Check");
      expect(markers[1].details.execution).toBe(2);
      expect(markers[2].details.stepName).toBe("Finish");

      expect(getCallCount()).toBe(2);
    }, 30000);
  });

  describe("check-todos-complete", () => {
    it("all items checked → condition false → advances sequentially", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeTodo(test.cwd, "done.md", [
        { text: "Task A", checked: true },
        { text: "Task B", checked: true },
      ]);

      writeWorkflow(test.cwd, "todos-done", {
        name: "todos-done",
        steps: [
          {
            name: "Work",
            model: "mock-model",
            prompt: "Do work",
            conditions: [
              { command: "check-todos-complete", args: { todoFilepath: "done.md" }, jump: "Work" },
            ],
          },
          { name: "End", model: "mock-model", prompt: "Finish" },
        ],
      });

      test.sendUserMessage("/workflow todos-done All done");
      await test.mockAgentResponse({ text: "Work done" });
      await new Promise(r => setTimeout(r, 200));
      // Condition is false (all checked) → advance to End
      await test.mockAgentResponse({ text: "Finished" });
      await test.waitForIdle();
      await new Promise(r => setTimeout(r, 200));

      const markers = test.events.customMessages("workflow:step-marker");
      expect(markers).toHaveLength(2);
      expect(markers[0].details.stepName).toBe("Work");
      expect(markers[1].details.stepName).toBe("End");
    }, 15000);

    it("unchecked items → condition true → jumps back", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeTodo(test.cwd, "pending.md", [
        { text: "Task A", checked: false },
      ]);

      writeWorkflow(test.cwd, "todos-pending", {
        name: "todos-pending",
        steps: [
          {
            name: "Work",
            model: "mock-model",
            prompt: "Do work",
            maxExecutions: 2,
            conditions: [
              { command: "check-todos-complete", args: { todoFilepath: "pending.md" }, jump: "Work" },
            ],
          },
          { name: "End", model: "mock-model", prompt: "Finish" },
        ],
      });

      test.sendUserMessage("/workflow todos-pending Fix stuff");

      // Execution 1 → unchecked → jump back
      await test.mockAgentResponse({ text: "Working" });
      await new Promise(r => setTimeout(r, 200));

      // Mark complete before execution 2's condition evaluates
      writeTodo(test.cwd, "pending.md", [{ text: "Task A", checked: true }]);

      // Execution 2 → all checked → advance
      await test.mockAgentResponse({ text: "Done" });
      await new Promise(r => setTimeout(r, 200));

      await test.mockAgentResponse({ text: "Finished" });
      await test.waitForIdle();
      await new Promise(r => setTimeout(r, 200));

      const markers = test.events.customMessages("workflow:step-marker");
      expect(markers).toHaveLength(3);
      expect(markers[0].details.stepName).toBe("Work");
      expect(markers[1].details.stepName).toBe("Work");
      expect(markers[2].details.stepName).toBe("End");
    }, 15000);
  });

  describe("negative existence conditions", () => {
    it("memory_key_not_exists jumps when the key is absent and advances once the key exists", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeWorkflow(test.cwd, "memory-key-not-exists-branch", {
        name: "memory-key-not-exists-branch",
        steps: [
          {
            name: "CheckPlan",
            model: "mock-model",
            prompt: "Check whether plan memory exists",
            conditions: [
              {
                command: "memory_key_not_exists",
                args: { memoryKey: "plan" },
                jump: "CreatePlan",
              },
            ],
          },
          { name: "CreatePlan", model: "mock-model", prompt: "Create the plan" },
          {
            name: "VerifyPlan",
            model: "mock-model",
            prompt: "Verify whether plan memory exists",
            maxExecutions: 2,
            conditions: [
              {
                command: "memory_key_not_exists",
                args: { memoryKey: "plan" },
                jump: "CreatePlan",
              },
            ],
          },
          { name: "Done", model: "mock-model", prompt: "Finish" },
        ],
      });

      test.sendUserMessage("/workflow memory-key-not-exists-branch Build the plan");

      await test.mockAgentResponse({ text: "Checked for plan" });
      await new Promise(r => setTimeout(r, 200));

      const workflowId = parseWorkflowId(test.events);
      writeKey(test.cwd, workflowId, "plan", "plans/feature");

      await test.mockAgentResponse({ text: "Created the plan" });
      await new Promise(r => setTimeout(r, 200));

      await test.mockAgentResponse({ text: "Verified the plan exists" });
      await new Promise(r => setTimeout(r, 200));

      await test.mockAgentResponse({ text: "Finished" });
      await test.waitForIdle();
      await new Promise(r => setTimeout(r, 200));

      const markers = test.events.customMessages("workflow:step-marker");
      expect(markers.map((m: any) => m.details.stepName)).toEqual([
        "CheckPlan",
        "CreatePlan",
        "VerifyPlan",
        "Done",
      ]);

      const condResults = test.events.customMessages("workflow:condition-result");
      const explanations = condResults.map((m: any) => String(m.details.explanation));
      expect(explanations).toContain('Memory key "plan" does not exist');
      expect(explanations).toContain('Memory key "plan" exists');
    }, 15000);

    it("file_not_exists resolves filepath from memory and advances once the file exists", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeWorkflow(test.cwd, "file-not-exists-memory-branch", {
        name: "file-not-exists-memory-branch",
        steps: [
          {
            name: "CheckDesign",
            model: "mock-model",
            prompt: "Check whether the design file exists",
            conditions: [
              {
                command: "file_not_exists",
                args: { memoryKey: "design-path" },
                jump: "GenerateDesign",
              },
            ],
          },
          { name: "GenerateDesign", model: "mock-model", prompt: "Generate the design" },
          {
            name: "VerifyDesign",
            model: "mock-model",
            prompt: "Verify whether the design file exists",
            maxExecutions: 2,
            conditions: [
              {
                command: "file_not_exists",
                args: { memoryKey: "design-path" },
                jump: "GenerateDesign",
              },
            ],
          },
          { name: "Done", model: "mock-model", prompt: "Finish" },
        ],
      });

      test.sendUserMessage("/workflow file-not-exists-memory-branch Build the design");

      await test.mockAgentResponse({ text: "Checked for design" });
      await new Promise(r => setTimeout(r, 200));

      const workflowId = parseWorkflowId(test.events);
      writeKey(test.cwd, workflowId, "design-path", "plans/feature/design.md");
      writeFile(test.cwd, "plans/feature/design.md", "# Design\n");

      await test.mockAgentResponse({ text: "Generated the design" });
      await new Promise(r => setTimeout(r, 200));

      await test.mockAgentResponse({ text: "Verified the design exists" });
      await new Promise(r => setTimeout(r, 200));

      await test.mockAgentResponse({ text: "Finished" });
      await test.waitForIdle();
      await new Promise(r => setTimeout(r, 200));

      const markers = test.events.customMessages("workflow:step-marker");
      expect(markers.map((m: any) => m.details.stepName)).toEqual([
        "CheckDesign",
        "GenerateDesign",
        "VerifyDesign",
        "Done",
      ]);

      const condResults = test.events.customMessages("workflow:condition-result");
      const explanations = condResults.map((m: any) => String(m.details.explanation));
      expect(explanations).toContain('Memory key "design-path" does not exist');
      expect(explanations).toContain("File exists: plans/feature/design.md");

      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("complete!"),
        })
      );
    }, 15000);
  });

  describe("modules", () => {
    it("computes effective modules from workflow-level and step-level", () => {
      const config = { name: "test", modules: ["memory"], steps: [] as any[] };
      const step = { name: "s", model: "m", prompt: "p", maxExecutions: 10 } as any;
      expect(computeEffectiveModules(config, step)).toEqual(["memory"]);
    });

    it("merges workflow-level and step-level modules without duplicates", () => {
      const config = { name: "test", modules: ["memory", "dev"], steps: [] as any[] };
      const step = { name: "s", model: "m", prompt: "p", modules: ["dev", "agent-todo"], maxExecutions: 10 } as any;
      const effective = computeEffectiveModules(config, step);
      expect(effective).toEqual(expect.arrayContaining(["memory", "dev", "agent-todo"]));
      expect(effective).toHaveLength(3);
    });

    it("returns empty when no modules specified", () => {
      const config = { name: "test", steps: [] as any[] };
      const step = { name: "s", model: "m", prompt: "p", maxExecutions: 10 } as any;
      expect(computeEffectiveModules(config, step)).toEqual([]);
    });
  });

  describe("model selection", () => {
    it("uses the specified model for each step", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeWorkflow(test.cwd, "model-test", {
        name: "model-test",
        steps: [
          { name: "Step1", model: "mock-model", prompt: "Do work" },
        ],
      });

      const capturedModels: any[] = [];
      const originalStreamFn = test.session.agent.streamFn;
      test.session.agent.streamFn = (model: any, context: any, options?: any) => {
        capturedModels.push(model);
        return originalStreamFn(model, context, options);
      };

      test.sendUserMessage("/workflow model-test Test model");
      await test.mockAgentResponse({ text: "Done" });
      await test.waitForIdle();

      expect(capturedModels.length).toBe(1);
      expect(capturedModels[0].id).toBe("mock-model");
    }, 15000);

    it("applies step thinking and defaults omitted thinking to off", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeWorkflow(test.cwd, "thinking-test", {
        name: "thinking-test",
        steps: [
          { name: "Step1", model: "mock-model", thinking: "high", prompt: "Think hard" },
          { name: "Step2", model: "mock-model", prompt: "No thinking" },
        ],
      });

      const capturedThinkingLevels: string[] = [];
      const originalStreamFn = test.session.agent.streamFn;
      test.session.agent.streamFn = (model: any, context: any, options?: any) => {
        capturedThinkingLevels.push(test!.session.agent.state.thinkingLevel);
        return originalStreamFn(model, context, options);
      };

      test.sendUserMessage("/workflow thinking-test Test thinking");
      await test.mockAgentResponse({ text: "Done 1" });
      await new Promise(r => setTimeout(r, 200));
      await test.mockAgentResponse({ text: "Done 2" });
      await test.waitForIdle();

      expect(capturedThinkingLevels).toEqual(["high", "off"]);
    }, 15000);
  });

  describe("model aliases", () => {
    it("resolves 'fast' to claude-haiku-4-5", () => {
      expect(resolveModelAlias("fast", "/tmp")).toBe("claude-haiku-4-5");
    });

    it("resolves 'smart' to claude-opus-4-6", () => {
      expect(resolveModelAlias("smart", "/tmp")).toBe("claude-opus-4-6");
    });

    it("resolves 'general' to claude-sonnet-4-6", () => {
      expect(resolveModelAlias("general", "/tmp")).toBe("claude-sonnet-4-6");
    });

    it("passes through non-alias model names unchanged", () => {
      expect(resolveModelAlias("mock-model", "/tmp")).toBe("mock-model");
    });
  });

  describe("maxExecutions", () => {
    it("stops jumping when maxExecutions reached and advances sequentially", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeTodo(test.cwd, "never-done.md", [
        { text: "Impossible task", checked: false },
      ]);

      writeWorkflow(test.cwd, "max-exec", {
        name: "max-exec",
        steps: [
          {
            name: "Loop",
            model: "mock-model",
            prompt: "Try to complete",
            maxExecutions: 2,
            conditions: [
              { command: "check-todos-complete", args: { todoFilepath: "never-done.md" }, jump: "Loop" },
            ],
          },
          { name: "Final", model: "mock-model", prompt: "Done" },
        ],
      });

      test.sendUserMessage("/workflow max-exec Test max executions");

      // Execution 1 → condition true (unchecked) → jump back
      await test.mockAgentResponse({ text: "Attempt 1" });
      await new Promise(r => setTimeout(r, 200));

      // Execution 2 → condition true (still unchecked) → maxExecutions reached → advance
      await test.mockAgentResponse({ text: "Attempt 2" });
      await new Promise(r => setTimeout(r, 200));

      // Final step
      await test.mockAgentResponse({ text: "Finished" });
      await test.waitForIdle();
      await new Promise(r => setTimeout(r, 200));

      const markers = test.events.customMessages("workflow:step-marker");
      const loopMarkers = markers.filter((m: any) => m.details.stepName === "Loop");
      expect(loopMarkers).toHaveLength(2);

      const finalMarkers = markers.filter((m: any) => m.details.stepName === "Final");
      expect(finalMarkers).toHaveLength(1);

      // Verify maxExecutions warning
      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("maxExecutions"),
        })
      );

      // Verify workflow completed
      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("complete!"),
        })
      );
    }, 30000);
  });

  describe("error halt", () => {
    it("pauses on agent error and resumes with /workflow continue", async () => {
      test = await createComponentTest();
      registerMockModel(test);
      test.session.setAutoRetryEnabled(false);

      writeWorkflow(test.cwd, "error-halt", {
        name: "error-halt",
        steps: [
          { name: "Step1", model: "mock-model", prompt: "Do step 1" },
          { name: "Step2", model: "mock-model", prompt: "Do step 2" },
        ],
      });

      test.sendUserMessage("/workflow error-halt Test error handling");

      // Step 1: simulate an API error
      await test.mockAgentResponse({ error: "Overloaded" });
      await new Promise(r => setTimeout(r, 300));

      // Verify workflow did NOT advance — no Step2 marker
      const markersAfterError = test.events.customMessages("workflow:step-marker");
      expect(markersAfterError).toHaveLength(1);
      expect(markersAfterError[0].details.stepName).toBe("Step1");

      // Verify error pause notification was shown
      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("Workflow paused (agent error)"),
        })
      );

      // Retry with /workflow continue
      test.sendUserMessage("/workflow continue");
      await new Promise(r => setTimeout(r, 300));

      // Step 1 retry succeeds
      await test.mockAgentResponse({ text: "Step 1 done" });
      await new Promise(r => setTimeout(r, 300));

      // Step 2 runs and completes
      await test.mockAgentResponse({ text: "Step 2 done" });
      await test.waitForIdle();
      await new Promise(r => setTimeout(r, 200));

      // Verify both steps completed
      const markers = test.events.customMessages("workflow:step-marker");
      // Step1 ran twice (error + retry), Step2 ran once
      expect(markers).toHaveLength(3);
      expect(markers[0].details.stepName).toBe("Step1");
      expect(markers[0].details.execution).toBe(1);
      expect(markers[1].details.stepName).toBe("Step1");
      expect(markers[1].details.execution).toBe(1); // decremented from 2 back to 1
      expect(markers[2].details.stepName).toBe("Step2");

      // Verify workflow completed
      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Workflow "error-halt" complete!'),
        })
      );
    }, 30000);

    it("aborts cleanly after error pause", async () => {
      test = await createComponentTest();
      registerMockModel(test);
      test.session.setAutoRetryEnabled(false);

      writeWorkflow(test.cwd, "error-abort", {
        name: "error-abort",
        steps: [
          { name: "Step1", model: "mock-model", prompt: "Do step 1" },
          { name: "Step2", model: "mock-model", prompt: "Do step 2" },
        ],
      });

      test.sendUserMessage("/workflow error-abort Test error abort");

      // Step 1: simulate an API error
      await test.mockAgentResponse({ error: "Overloaded" });
      await new Promise(r => setTimeout(r, 300));

      // Verify workflow paused
      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("Workflow paused (agent error)"),
        })
      );

      // Abort the workflow
      await test.runCommand("/workflow abort");
      await test.waitForIdle();

      // Verify workflow was aborted
      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("aborted"),
        })
      );

      // Verify no Step2 was executed
      const markers = test.events.customMessages("workflow:step-marker");
      expect(markers).toHaveLength(1);
      expect(markers[0].details.stepName).toBe("Step1");
    }, 15000);

    it("handles repeated errors — re-pauses on second error, succeeds on third attempt", async () => {
      test = await createComponentTest();
      registerMockModel(test);
      test.session.setAutoRetryEnabled(false);

      writeWorkflow(test.cwd, "double-error", {
        name: "double-error",
        steps: [
          { name: "Step1", model: "mock-model", prompt: "Do step 1" },
          { name: "Step2", model: "mock-model", prompt: "Do step 2" },
        ],
      });

      test.sendUserMessage("/workflow double-error Test double error");

      // Step 1: first error
      await test.mockAgentResponse({ error: "Overloaded" });
      await new Promise(r => setTimeout(r, 300));

      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("Workflow paused (agent error)"),
        })
      );

      // First retry — another error
      test.sendUserMessage("/workflow continue");
      await new Promise(r => setTimeout(r, 300));

      await test.mockAgentResponse({ error: "Overloaded again" });
      await new Promise(r => setTimeout(r, 300));

      // Should be paused again
      const errorNotifs = test.notifications.filter(n =>
        n.message.includes("Workflow paused (agent error)")
      );
      expect(errorNotifs.length).toBeGreaterThanOrEqual(2);

      // Second retry — succeeds this time
      test.sendUserMessage("/workflow continue");
      await new Promise(r => setTimeout(r, 300));

      await test.mockAgentResponse({ text: "Step 1 done" });
      await new Promise(r => setTimeout(r, 300));

      // Step 2 runs normally
      await test.mockAgentResponse({ text: "Step 2 done" });
      await test.waitForIdle();
      await new Promise(r => setTimeout(r, 200));

      // Verify workflow completed
      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Workflow "double-error" complete!'),
        })
      );

      // Verify Step1 markers: error1, error2, success = 3 markers, but errored ones
      // had their counts decremented, so the successful run shows execution 1
      const markers = test.events.customMessages("workflow:step-marker");
      const step1Markers = markers.filter((m: any) => m.details.stepName === "Step1");
      expect(step1Markers).toHaveLength(3); // error, error, success

      const step2Markers = markers.filter((m: any) => m.details.stepName === "Step2");
      expect(step2Markers).toHaveLength(1);
    }, 30000);

    it("error on a step with conditions halts before condition evaluation", async () => {
      test = await createComponentTest();
      registerMockModel(test);
      test.session.setAutoRetryEnabled(false);

      writeTodo(test.cwd, "cond-error.md", [
        { text: "Task A", checked: false },
      ]);

      writeWorkflow(test.cwd, "cond-error", {
        name: "cond-error",
        steps: [
          {
            name: "Work",
            model: "mock-model",
            prompt: "Do work",
            maxExecutions: 5,
            conditions: [
              { command: "check-todos-complete", args: { todoFilepath: "cond-error.md" }, jump: "Work" },
            ],
          },
          { name: "Done", model: "mock-model", prompt: "Finish" },
        ],
      });

      test.sendUserMessage("/workflow cond-error Test condition error");

      // Step 1: error — should halt before conditions are evaluated
      await test.mockAgentResponse({ error: "Service unavailable" });
      await new Promise(r => setTimeout(r, 300));

      // Verify paused
      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("Workflow paused (agent error)"),
        })
      );

      // No condition results should have been emitted
      const condResults = test.events.customMessages("workflow:condition-result");
      expect(condResults).toHaveLength(0);

      // Mark task complete before retry
      writeTodo(test.cwd, "cond-error.md", [
        { text: "Task A", checked: true },
      ]);

      // Retry with /workflow continue
      test.sendUserMessage("/workflow continue");
      await new Promise(r => setTimeout(r, 300));

      // Step succeeds this time; condition evaluates (all checked → false → advance)
      await test.mockAgentResponse({ text: "Work done" });
      await new Promise(r => setTimeout(r, 300));

      // Done step
      await test.mockAgentResponse({ text: "Finished" });
      await test.waitForIdle();
      await new Promise(r => setTimeout(r, 200));

      // Verify conditions were evaluated after retry
      const condResultsAfter = test.events.customMessages("workflow:condition-result");
      expect(condResultsAfter.length).toBeGreaterThanOrEqual(1);

      // Verify workflow completed
      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Workflow "cond-error" complete!'),
        })
      );
    }, 30000);
  });

  describe("prompt file injection", () => {
    it("resolves @path prompt from file content", async () => {
      test = await createComponentTest({
        initialPrompts: [{ name: "test-prompt", content: "INJECTED_PROMPT_CONTENT_XYZ" }],
      });
      registerMockModel(test);

      writeWorkflow(test.cwd, "prompt-file", {
        name: "prompt-file",
        steps: [
          { name: "Step1", model: "mock-model", prompt: "@test-prompt" },
        ],
      });

      // Capture contexts to verify prompt content
      const capturedContexts: any[] = [];
      const originalStreamFn = test.session.agent.streamFn;
      test.session.agent.streamFn = (model: any, context: any, options?: any) => {
        capturedContexts.push(JSON.parse(JSON.stringify(context)));
        return originalStreamFn(model, context, options);
      };

      test.sendUserMessage("/workflow prompt-file Use prompt file");
      await test.mockAgentResponse({ text: "Done" });
      await test.waitForIdle();
      await new Promise(r => setTimeout(r, 200));

      // The resolved prompt content should appear in the user message sent to the agent
      expect(capturedContexts.length).toBe(1);
      const allText = JSON.stringify(capturedContexts[0].messages);
      expect(allText).toContain("INJECTED_PROMPT_CONTENT_XYZ");
    }, 15000);

    it("resolves nested local prompt directories via /workflow command", async () => {
      test = await createComponentTest({
        initialPrompts: [{ name: "pack/task", content: "NESTED_LOCAL_PROMPT_CONTENT" }],
      });
      registerMockModel(test);

      writeWorkflow(test.cwd, "prompt-nested-local", {
        name: "prompt-nested-local",
        steps: [{ name: "Step1", model: "mock-model", prompt: "@pack/task" }],
      });

      const capturedContexts: any[] = [];
      const originalStreamFn = test.session.agent.streamFn;
      test.session.agent.streamFn = (model: any, context: any, options?: any) => {
        capturedContexts.push(JSON.parse(JSON.stringify(context)));
        return originalStreamFn(model, context, options);
      };

      await test.runCommand("/workflow prompt-nested-local Run nested local");
      await test.waitForIdle();

      const allNotifications = test.notifications.map(n => n.message).join("\n");
      expect(allNotifications).not.toMatch(/prompt reference not found|ambiguous prompt reference/i);
      expect(capturedContexts.length).toBeGreaterThan(0);
      const allText = JSON.stringify(capturedContexts[0].messages);
      expect(allText).toContain("NESTED_LOCAL_PROMPT_CONTENT");
    }, 15000);

    it("falls back to ~/.pi/prompts nested directories via /workflow command", async () => {
      test = await createComponentTest({
        initialHomePrompts: [{ name: "pack/task", content: "HOME_NESTED_PROMPT_CONTENT" }],
      });
      registerMockModel(test);

      writeWorkflow(test.cwd, "prompt-nested-home", {
        name: "prompt-nested-home",
        steps: [{ name: "Step1", model: "mock-model", prompt: "@pack/task" }],
      });

      const capturedContexts: any[] = [];
      const originalStreamFn = test.session.agent.streamFn;
      test.session.agent.streamFn = (model: any, context: any, options?: any) => {
        capturedContexts.push(JSON.parse(JSON.stringify(context)));
        return originalStreamFn(model, context, options);
      };

      await test.runCommand("/workflow prompt-nested-home Run nested home");
      await test.waitForIdle();

      const allNotifications = test.notifications.map(n => n.message).join("\n");
      expect(allNotifications).not.toMatch(/prompt reference not found|ambiguous prompt reference/i);
      expect(capturedContexts.length).toBeGreaterThan(0);
      const allText = JSON.stringify(capturedContexts[0].messages);
      expect(allText).toContain("HOME_NESTED_PROMPT_CONTENT");
    }, 15000);

    it("shows actionable error for ambiguous nested prompt refs", async () => {
      test = await createComponentTest({
        initialPrompts: [{ name: "pack/task", content: "LOCAL_PROMPT_CONTENT" }],
        initialHomePrompts: [{ name: "pack/task", content: "HOME_PROMPT_CONTENT" }],
      });
      registerMockModel(test);

      writeWorkflow(test.cwd, "prompt-nested-ambiguous", {
        name: "prompt-nested-ambiguous",
        steps: [{ name: "Step1", model: "mock-model", prompt: "@pack/task" }],
      });

      await test.runCommand("/workflow prompt-nested-ambiguous Run ambiguous");
      await test.waitForIdle();

      const allNotifications = test.notifications.map(n => n.message).join("\n");
      expect(allNotifications).toMatch(/ambiguous prompt reference/i);
      expect(allNotifications).toContain("pack/task");
      expect(allNotifications).toContain(".pi/prompts/pack/task.md");
    }, 15000);

  });

  describe("context clearing on loop-back jumps", () => {
    it("clears context window when condition loops back to a previous step", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeTodo(test.cwd, "loop-tasks.md", [
        { text: "Looping task", checked: false },
      ]);

      writeWorkflow(test.cwd, "loop-context", {
        name: "loop-context",
        steps: [
          {
            name: "Plan",
            model: "mock-model",
            prompt: "Plan the work",
          },
          {
            name: "Execute",
            model: "mock-model",
            prompt: "Execute the plan",
            maxExecutions: 5,
            conditions: [
              { command: "check-todos-complete", args: { todoFilepath: "loop-tasks.md" }, jump: "Execute" },
            ],
          },
          {
            name: "Summarize",
            model: "mock-model",
            prompt: "Summarize results",
          },
        ],
      });

      // Capture every context sent to the LLM
      const capturedContexts: { stepName: string; execution: number; messages: any[] }[] = [];
      const originalStreamFn = test.session.agent.streamFn;
      test.session.agent.streamFn = (model: any, context: any, options?: any) => {
        // Determine which step this is for by checking the latest step marker in notifications
        const markers = test.events.customMessages("workflow:step-marker");
        const lastMarker = markers[markers.length - 1];
        capturedContexts.push({
          stepName: lastMarker?.details?.stepName ?? "unknown",
          execution: lastMarker?.details?.execution ?? 0,
          messages: JSON.parse(JSON.stringify(context.messages)),
        });
        return originalStreamFn(model, context, options);
      };

      test.sendUserMessage("/workflow loop-context Test loop context clearing");

      // Step 1: Plan
      await test.mockAgentResponse({ text: "PLAN_RESPONSE_UNIQUE_MARKER" });
      await new Promise(r => setTimeout(r, 200));

      // Step 2: Execute (execution 1) → todos unchecked → loops back
      await test.mockAgentResponse({ text: "EXECUTE_ITER1_UNIQUE_MARKER" });
      await new Promise(r => setTimeout(r, 200));

      // Step 2: Execute (execution 2) → still unchecked → loops back
      await test.mockAgentResponse({ text: "EXECUTE_ITER2_UNIQUE_MARKER" });
      await new Promise(r => setTimeout(r, 200));

      // Step 2: Execute (execution 3) → still unchecked → loops back
      await test.mockAgentResponse({ text: "EXECUTE_ITER3_UNIQUE_MARKER" });
      await new Promise(r => setTimeout(r, 200));

      // Mark complete so we advance
      writeTodo(test.cwd, "loop-tasks.md", [
        { text: "Looping task", checked: true },
      ]);

      // Step 2: Execute (execution 4) → now complete → advances to Summarize
      await test.mockAgentResponse({ text: "EXECUTE_ITER4_UNIQUE_MARKER" });
      await new Promise(r => setTimeout(r, 200));

      // Step 3: Summarize
      await test.mockAgentResponse({ text: "SUMMARIZE_RESPONSE" });
      await test.waitForIdle();
      await new Promise(r => setTimeout(r, 200));

      // Verify we got the right number of step executions
      const markers = test.events.customMessages("workflow:step-marker");
      const executeMarkers = markers.filter((m: any) => m.details.stepName === "Execute");
      expect(executeMarkers).toHaveLength(4);

      // Now verify context isolation for each Execute iteration
      const executeContexts = capturedContexts.filter(c => c.stepName === "Execute");
      expect(executeContexts.length).toBe(4);

      // Each Execute iteration's context should NOT contain responses from previous iterations
      for (let i = 0; i < executeContexts.length; i++) {
        const ctxText = JSON.stringify(executeContexts[i].messages);

        // Should NOT contain Plan step's response
        expect(ctxText).not.toContain("PLAN_RESPONSE_UNIQUE_MARKER");

        // Should NOT contain any previous Execute iteration's response
        for (let j = 0; j < i; j++) {
          expect(ctxText).not.toContain(`EXECUTE_ITER${j + 1}_UNIQUE_MARKER`);
        }
      }

      // Summarize step should NOT contain any Execute iteration responses
      const summarizeContexts = capturedContexts.filter(c => c.stepName === "Summarize");
      expect(summarizeContexts.length).toBe(1);
      const summarizeText = JSON.stringify(summarizeContexts[0].messages);
      expect(summarizeText).not.toContain("PLAN_RESPONSE_UNIQUE_MARKER");
      expect(summarizeText).not.toContain("EXECUTE_ITER1_UNIQUE_MARKER");
      expect(summarizeText).not.toContain("EXECUTE_ITER2_UNIQUE_MARKER");
      expect(summarizeText).not.toContain("EXECUTE_ITER3_UNIQUE_MARKER");
      expect(summarizeText).not.toContain("EXECUTE_ITER4_UNIQUE_MARKER");

      // Verify workflow completed
      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("complete!"),
        })
      );
    }, 45000);
  });



  describe("workflow subcommands", () => {
    it("/workflow continue — error when no workflow running", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      await test.runCommand("/workflow continue");
      await test.waitForIdle();

      expect(test.notifications).toContainEqual(
        expect.objectContaining({ message: "No workflow is running" })
      );
    }, 15000);

    it("/workflow status — shows no workflow when none running", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      await test.runCommand("/workflow status");
      await test.waitForIdle();

      expect(test.notifications).toContainEqual(
        expect.objectContaining({ message: "No workflow is running" })
      );
    }, 15000);

    it("/workflow abort — error when no workflow running", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      await test.runCommand("/workflow abort");
      await test.waitForIdle();

      expect(test.notifications).toContainEqual(
        expect.objectContaining({ message: "No workflow is running" })
      );
    }, 15000);

    it("/workflow <nonexistent> — error for unknown workflow", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      await test.runCommand("/workflow nonexistent-workflow test");
      await test.waitForIdle();

      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("nonexistent-workflow"),
        })
      );
    }, 15000);

    it("/workflow abort — cancels a running workflow", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeWorkflow(test.cwd, "abort-test", {
        name: "abort-test",
        steps: [
          { name: "Step1", model: "mock-model", prompt: "Do step 1", approval: true },
          { name: "Step2", model: "mock-model", prompt: "Do step 2" },
        ],
      });

      test.sendUserMessage("/workflow abort-test Test abort");
      await test.mockAgentResponse({ text: "Step 1 done" });
      await new Promise(r => setTimeout(r, 300));

      // Workflow should be paused at approval gate
      await test.runCommand("/workflow abort");
      await test.waitForIdle();

      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("aborted"),
        })
      );

      // Verify no Step2 executed
      const markers = test.events.customMessages("workflow:step-marker");
      expect(markers).toHaveLength(1);
      expect(markers[0].details.stepName).toBe("Step1");
    }, 15000);

    it("/workflow status — shows current step info during workflow", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeWorkflow(test.cwd, "status-test", {
        name: "status-test",
        steps: [
          { name: "FirstStep", model: "mock-model", prompt: "Do step 1", approval: true },
          { name: "SecondStep", model: "mock-model", prompt: "Do step 2" },
        ],
      });

      test.sendUserMessage("/workflow status-test Test status");
      await test.mockAgentResponse({ text: "Step 1 done" });
      await new Promise(r => setTimeout(r, 300));

      // Workflow paused at approval gate, check status
      await test.runCommand("/workflow status");
      await test.waitForIdle();

      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringMatching(/status-test.*Step 1\/2.*FirstStep.*awaiting approval/),
        })
      );
    }, 15000);

    it("/workflow <name> — error when workflow already running", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeWorkflow(test.cwd, "double-start", {
        name: "double-start",
        steps: [
          { name: "Step1", model: "mock-model", prompt: "Do step 1", approval: true },
        ],
      });

      test.sendUserMessage("/workflow double-start Test double start");
      await test.mockAgentResponse({ text: "Step 1 done" });
      await new Promise(r => setTimeout(r, 300));

      // Try starting another workflow while one is running
      await test.runCommand("/workflow double-start Another test");
      await test.waitForIdle();

      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("already running"),
        })
      );
    }, 15000);
  });

  describe("production workflows (end-to-end)", () => {
    it("feature.yml — runs through all steps with approval gate and memory-based condition", async () => {
      test = await createComponentTest({ shownModules: ["memory"] });
      registerMockModel(test);

      test.sendUserMessage("/workflow feature Build a cool feature");

      // Wait for the step message to be emitted (contains Workflow: <uuid>)
      await new Promise(r => setTimeout(r, 500));
      const workflowId = parseWorkflowId(test.events);

      // --- Step 1: Brainstorm (approval: true) ---
      await test.mockAgentResponse({
        toolCalls: [
          { name: "write", args: { path: "plans/feature/design.md", content: "# Design\n\nFeature design document." } },
        ],
      });
      await test.mockAgentResponse({ text: "I've written the design document." });
      // Workflow pauses at approval gate
      await new Promise(r => setTimeout(r, 300));

      // Third response needed — agent loop runs 3 turns for tool-call flow
      await test.mockAgentResponse({ text: "Done with brainstorm." });

      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("/workflow continue"),
        })
      );

      test.sendUserMessage("/workflow continue");
      await new Promise(r => setTimeout(r, 300));

      // --- Step 2: Plan ---
      // Write todo with all items checked + store path in workflow memory
      await test.mockAgentResponse({
        toolCalls: [
          { name: "write", args: { path: "plans/feature/overview.md", content: "# Plan Overview" } },
          { name: "write", args: { path: "plans/feature/todo.md", content: "- [x] Task 1\n- [x] Task 2" } },
          { name: "memory_add", args: { store: workflowId, key: "plan", value: "plans/feature" } },
          { name: "memory_add", args: { store: workflowId, key: "plan-todo", value: "plans/feature/todo.md" } },
        ],
      });
      await test.mockAgentResponse({ text: "Plan is ready." });
      await new Promise(r => setTimeout(r, 300));

      // --- Step 3: Implement (condition: check-todos-complete memoryKey=plan-todo) ---
      // Todo file has all items checked → condition false → advance → workflow complete
      await test.mockAgentResponse({ text: "All tasks implemented." });
      await test.waitForIdle();
      await new Promise(r => setTimeout(r, 300));

      // --- Assertions ---
      const markers = test.events.customMessages("workflow:step-marker");
      expect(markers).toHaveLength(3);
      expect(markers[0].details.stepName).toBe("Brainstorm");
      expect(markers[1].details.stepName).toBe("Plan");
      expect(markers[2].details.stepName).toBe("Implement");

      const errorNotifications = test.notifications.filter(
        (n) => /prompt reference not found|ambiguous prompt reference/i.test(n.message)
      );
      expect(errorNotifications).toHaveLength(0);

      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("complete!"),
        })
      );
    }, 30000);

    it("research.yml — prompt condition with real evaluation", async () => {
      test = await createComponentTest({ shownModules: ["memory"] });
      registerMockModel(test);

      writeWorkflow(test.cwd, "research", {
        name: "research",
        steps: [
          { name: "Clarify", model: "mock-model", prompt: "Clarify the research question", approval: true },
          { name: "Search", model: "mock-model", prompt: "Search for relevant sources" },
          { name: "Deep Dive", model: "mock-model", prompt: "Deep dive into the topic" },
          {
            name: "Synthesize",
            model: "mock-model",
            prompt: "Synthesize findings",
            conditions: [
              { prompt: "Is more research needed?", model: "mock-model", jump: "Search" },
            ],
          },
        ],
      });

      installConditionOverride(() => ({
        result: "false",
        explanation: "Research is sufficient",
      }));

      test.sendUserMessage("/workflow research Test research workflow");

      // --- Step 1: Clarify (approval: true) ---
      await test.mockAgentResponse({ text: "Clarified the question." });
      await new Promise(r => setTimeout(r, 300));
      test.sendUserMessage("/workflow continue");
      await new Promise(r => setTimeout(r, 300));

      // --- Step 2: Search ---
      await test.mockAgentResponse({ text: "Search complete." });
      await new Promise(r => setTimeout(r, 300));

      // --- Step 3: Deep Dive ---
      await test.mockAgentResponse({ text: "Deep dive complete." });
      await new Promise(r => setTimeout(r, 300));

      // --- Step 4: Synthesize (prompt condition → false → advance → done) ---
      await test.mockAgentResponse({ text: "Synthesis complete." });
      await test.waitForIdle();
      await new Promise(r => setTimeout(r, 300));

      const markers = test.events.customMessages("workflow:step-marker");
      expect(markers).toHaveLength(4);
      expect(markers[0].details.stepName).toBe("Clarify");
      expect(markers[1].details.stepName).toBe("Search");
      expect(markers[2].details.stepName).toBe("Deep Dive");
      expect(markers[3].details.stepName).toBe("Synthesize");

      const errorNotifications = test.notifications.filter(
        (n) => /prompt reference not found|ambiguous prompt reference/i.test(n.message)
      );
      expect(errorNotifications).toHaveLength(0);

      expect(test.notifications).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("complete!"),
        })
      );
    }, 30000);
  });
});
