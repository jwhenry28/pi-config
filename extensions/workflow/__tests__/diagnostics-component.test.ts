import { describe, it, expect, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createComponentTest,
  type ComponentTestSession,
  writeWorkflow,
  writeTodo,
} from "../../testutils/component/index.js";
import {
  registerMockModel,
  runWorkflow,
  parseWorkflowId,
  installConditionOverride,
} from "./helpers.js";
import { setConditionStreamFnOverride } from "../evaluator.js";
import { DIAGNOSTICS_DIR, type WorkflowDiagnostics } from "../diagnostics.js";

function readDiag(cwd: string, workflowId: string): WorkflowDiagnostics {
  const diagPath = join(cwd, DIAGNOSTICS_DIR, `${workflowId}.json`);
  if (!existsSync(diagPath)) {
    throw new Error(`Diagnostics file not found: ${diagPath}`);
  }
  return JSON.parse(readFileSync(diagPath, "utf-8"));
}

describe("workflow diagnostics (component)", () => {
  let test: ComponentTestSession | undefined;

  afterEach(() => {
    setConditionStreamFnOverride(undefined);
    test?.dispose();
    test = undefined;
  });

  describe("completed workflow", () => {
    it("creates diagnostics file with correct structure after workflow completion", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeWorkflow(test.cwd, "diag-basic", {
        name: "diag-basic",
        steps: [
          { name: "Step1", model: "mock-model", prompt: "Do step 1" },
          { name: "Step2", model: "mock-model", prompt: "Do step 2" },
        ],
      });

      await runWorkflow(test, "/workflow diag-basic Test diagnostics", 2);

      const workflowId = parseWorkflowId(test.events);
      const diagPath = join(test.cwd, DIAGNOSTICS_DIR, `${workflowId}.json`);
      expect(existsSync(diagPath)).toBe(true);

      const data = readDiag(test.cwd, workflowId);
      expect(data.workflowName).toBe("diag-basic");
      expect(data.status).toBe("completed");
      expect(data.startedAt).toBeTruthy();
      expect(data.completedAt).toBeTruthy();
      expect(data.steps.length).toBeGreaterThanOrEqual(2);

      // Verify step names and execution numbers
      const stepNames = data.steps.map((s) => s.name);
      expect(stepNames).toContain("Step1");
      expect(stepNames).toContain("Step2");

      for (const step of data.steps) {
        expect(step.execution).toBe(1);
        expect(step.model).toBe("mock-model");
        expect(step.tokens).toHaveProperty("input");
        expect(step.tokens).toHaveProperty("output");
        expect(step.tokens).toHaveProperty("totalTokens");
        expect(step.tokens).toHaveProperty("cost");
      }

      // Totals structure
      expect(data.totals).toHaveProperty("input");
      expect(data.totals).toHaveProperty("output");
      expect(data.totals).toHaveProperty("totalTokens");
      expect(data.totals).toHaveProperty("cost");
    }, 15000);
  });

  describe("aborted workflow", () => {
    it("records aborted status when workflow is aborted via /workflow abort", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeWorkflow(test.cwd, "diag-abort", {
        name: "diag-abort",
        steps: [
          {
            name: "Step1",
            model: "mock-model",
            prompt: "Do step 1",
            approval: true,
          },
          { name: "Step2", model: "mock-model", prompt: "Do step 2" },
        ],
      });

      // Start workflow — Step1 has approval: true, so it pauses after agent response
      test.sendUserMessage("/workflow diag-abort Test abort");
      await test.mockAgentResponse({ text: "Step 1 done" });
      await new Promise((r) => setTimeout(r, 300));

      // Extract workflow ID while workflow is still running (paused at approval)
      const workflowId = parseWorkflowId(test.events);

      // Abort the workflow
      await test.runCommand("/workflow abort");
      await test.waitForIdle();
      await new Promise((r) => setTimeout(r, 100));

      // Verify diagnostics file shows aborted
      const diagPath = join(test.cwd, DIAGNOSTICS_DIR, `${workflowId}.json`);
      expect(existsSync(diagPath)).toBe(true);

      const data = readDiag(test.cwd, workflowId);
      expect(data.status).toBe("aborted");
      expect(data.completedAt).toBeTruthy();
      expect(data.workflowName).toBe("diag-abort");

      // Step1 should be recorded
      expect(data.steps.length).toBeGreaterThanOrEqual(1);
      expect(data.steps[0].name).toBe("Step1");
    }, 15000);
  });

  describe("loop-back conditions", () => {
    it("tracks multiple executions of the same step via command conditions", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeTodo(test.cwd, "diag-tasks.md", [
        { text: "Task A", checked: false },
      ]);

      writeWorkflow(test.cwd, "diag-loop", {
        name: "diag-loop",
        steps: [
          {
            name: "DoWork",
            model: "mock-model",
            prompt: "Work on tasks",
            maxExecutions: 3,
            conditions: [
              {
                command: "check-todos-complete",
                args: { todoFilepath: "diag-tasks.md" },
                jump: "DoWork",
              },
            ],
          },
          { name: "Done", model: "mock-model", prompt: "Summarize" },
        ],
      });

      test.sendUserMessage("/workflow diag-loop Fix loop");

      // Execution 1: todos incomplete → jumps back
      await test.mockAgentResponse({ text: "Working" });
      await new Promise((r) => setTimeout(r, 200));

      // Mark complete before execution 2
      writeTodo(test.cwd, "diag-tasks.md", [
        { text: "Task A", checked: true },
      ]);

      // Execution 2: todos complete → advance to Done
      await test.mockAgentResponse({ text: "Finished" });
      await new Promise((r) => setTimeout(r, 200));

      // Done step
      await test.mockAgentResponse({ text: "Summary" });
      await test.waitForIdle();
      await new Promise((r) => setTimeout(r, 200));

      const workflowId = parseWorkflowId(test.events);
      const data = readDiag(test.cwd, workflowId);

      expect(data.status).toBe("completed");

      // Should have DoWork execution 1, DoWork execution 2, and Done execution 1
      const doWorkEntries = data.steps.filter((s) => s.name === "DoWork");
      expect(doWorkEntries.length).toBeGreaterThanOrEqual(2);
      expect(doWorkEntries[0].execution).toBe(1);
      expect(doWorkEntries[1].execution).toBe(2);

      const doneEntries = data.steps.filter((s) => s.name === "Done");
      expect(doneEntries).toHaveLength(1);
      expect(doneEntries[0].execution).toBe(1);
    }, 20000);

    it("tracks prompt condition loop-backs with separate step entries", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeWorkflow(test.cwd, "diag-prompt-loop", {
        name: "diag-prompt-loop",
        steps: [
          {
            name: "Check",
            model: "mock-model",
            prompt: "Do work",
            conditions: [
              {
                prompt: "Is there more work?",
                model: "mock-model",
                jump: "Check",
              },
            ],
            maxExecutions: 3,
          },
          { name: "Finish", model: "mock-model", prompt: "Wrap up" },
        ],
      });

      const { getCallCount } = installConditionOverride((callIndex) =>
        callIndex <= 1
          ? { result: "true", explanation: "More work needed" }
          : { result: "false", explanation: "All done" },
      );

      test.sendUserMessage("/workflow diag-prompt-loop Test prompt conditions");

      // Execution 1 → condition true → jump back
      await test.mockAgentResponse({ text: "First pass" });
      await new Promise((r) => setTimeout(r, 2000));

      // Execution 2 → condition false → advance to Finish
      await test.mockAgentResponse({ text: "Second pass" });
      await new Promise((r) => setTimeout(r, 2000));

      // Finish step
      await test.mockAgentResponse({ text: "Wrapped up" });
      await test.waitForIdle();
      await new Promise((r) => setTimeout(r, 200));

      const workflowId = parseWorkflowId(test.events);
      const data = readDiag(test.cwd, workflowId);

      expect(data.status).toBe("completed");

      // Check step has execution 1 and 2
      const checkEntries = data.steps.filter((s) => s.name === "Check");
      expect(checkEntries.length).toBeGreaterThanOrEqual(2);
      expect(checkEntries[0].execution).toBe(1);
      expect(checkEntries[1].execution).toBe(2);

      const finishEntries = data.steps.filter((s) => s.name === "Finish");
      expect(finishEntries).toHaveLength(1);

      expect(getCallCount()).toBe(2);
    }, 30000);
  });

  describe("single-step workflow", () => {
    it("creates diagnostics for a single-step workflow", async () => {
      test = await createComponentTest();
      registerMockModel(test);

      writeWorkflow(test.cwd, "diag-single", {
        name: "diag-single",
        steps: [
          { name: "OnlyStep", model: "mock-model", prompt: "Do everything" },
        ],
      });

      await runWorkflow(test, "/workflow diag-single Single step test", 1);

      const workflowId = parseWorkflowId(test.events);
      const data = readDiag(test.cwd, workflowId);

      expect(data.status).toBe("completed");
      expect(data.steps.length).toBeGreaterThanOrEqual(1);
      expect(data.steps[0].name).toBe("OnlyStep");
      expect(data.steps[0].execution).toBe(1);
    }, 15000);
  });
});
