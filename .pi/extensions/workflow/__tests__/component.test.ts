import { describe, it, expect, afterEach } from "vitest";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import { createComponentTest, type ComponentTestSession } from "../../testutils/component/index.js";
import { writeWorkflow, writeTodo, writeFile } from "../../testutils/component/index.js";
import { registerMockModel, runWorkflow } from "./helpers.js";
import { setConditionStreamFnOverride } from "../evaluator.js";
import { computeEffectiveModules } from "../runner.js";
import { resolveModelAlias } from "../models.js";

describe("workflow extension (component)", () => {
  let test: ComponentTestSession | undefined;
  afterEach(() => {
    test?.dispose();
    test = undefined;
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

      let conditionCallCount = 0;

      let condStreamCallIndex = 0;
      setConditionStreamFnOverride((_model: any, context: any, _options?: any) => {
        condStreamCallIndex++;
        const stream = createAssistantMessageEventStream();
        const callIdx = condStreamCallIndex;

        // Check if this is a follow-up call after tool execution (has tool_result in messages)
        const hasToolResult = context.messages?.some((m: any) => m.role === "toolResult");
        if (hasToolResult) {
          // After tool execution, just emit end_turn with text
          queueMicrotask(() => {
            const partial: any = {
              role: "assistant",
              content: [{ type: "text", text: "Condition evaluated." }],
              api: "anthropic-messages",
              provider: "anthropic",
              model: "mock-model",
              usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
              stopReason: "endTurn",
              timestamp: Date.now(),
            };
            stream.push({ type: "start", partial });
            stream.push({ type: "text_start", contentIndex: 0, partial });
            stream.push({ type: "text_delta", contentIndex: 0, delta: "Condition evaluated.", partial });
            stream.push({ type: "text_end", contentIndex: 0, partial });
            stream.push({ type: "done", reason: "endTurn", message: partial });
          });
          return stream;
        }

        conditionCallCount++;
        const shouldJump = conditionCallCount <= 1;

        queueMicrotask(() => {
          const toolCall = {
            type: "toolCall" as const,
            id: `cond-tc-${callIdx}`,
            name: "evaluate_condition",
            arguments: {
              result: shouldJump ? "true" : "false",
              explanation: shouldJump ? "More work needed" : "All done",
            },
          };

          const partial: any = {
            role: "assistant",
            content: [toolCall],
            api: "anthropic-messages",
            provider: "anthropic",
            model: "mock-model",
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            stopReason: "toolUse",
            timestamp: Date.now(),
          };

          stream.push({ type: "start", partial });
          stream.push({ type: "toolcall_start", contentIndex: 0, partial });
          stream.push({ type: "toolcall_delta", contentIndex: 0, delta: JSON.stringify(toolCall.arguments), partial });
          stream.push({ type: "toolcall_end", contentIndex: 0, toolCall, partial });
          stream.push({ type: "done", reason: "toolUse", message: { ...partial, content: [toolCall] } });
        });

        return stream;
      });

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

      expect(conditionCallCount).toBe(2);
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

  describe("prompt file injection", () => {
    it("resolves @path prompt from file content", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeFile(test.cwd, ".pi/prompts/test-prompt.md", "INJECTED_PROMPT_CONTENT_XYZ");

      writeWorkflow(test.cwd, "prompt-file", {
        name: "prompt-file",
        steps: [
          { name: "Step1", model: "mock-model", prompt: "@.pi/prompts/test-prompt.md" },
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
});
