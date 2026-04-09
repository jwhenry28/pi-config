import { describe, it, expect, afterEach } from "vitest";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  createDiagnostics,
  readDiagnostics,
  recordStepUsage,
  completeDiagnostics,
  extractUsageFromMessage,
  type TokenUsage,
  type WorkflowDiagnostics,
  DIAGNOSTICS_DIR,
} from "../diagnostics.js";

describe("diagnostics", () => {
  const dirs: string[] = [];
  function makeTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "diag-test-"));
    dirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const d of dirs) {
      if (existsSync(d)) rmSync(d, { recursive: true });
    }
    dirs.length = 0;
  });

  describe("createDiagnostics", () => {
    it("creates a JSON file with running status and empty steps", () => {
      const cwd = makeTempDir();
      const workflowId = "test-wf-001";

      createDiagnostics(cwd, workflowId, "My Workflow");

      const filePath = join(cwd, DIAGNOSTICS_DIR, `${workflowId}.json`);
      expect(existsSync(filePath)).toBe(true);

      const data: WorkflowDiagnostics = JSON.parse(readFileSync(filePath, "utf-8"));
      expect(data.workflowName).toBe("My Workflow");
      expect(data.status).toBe("running");
      expect(data.startedAt).toBeTruthy();
      expect(data.completedAt).toBeNull();
      expect(data.steps).toEqual([]);
      expect(data.totals).toEqual({ input: 0, output: 0, totalTokens: 0, cost: 0 });
    });

    it("does not overwrite existing diagnostics file", () => {
      const cwd = makeTempDir();
      const workflowId = "test-wf-idempotent";

      createDiagnostics(cwd, workflowId, "My Workflow");
      recordStepUsage(cwd, workflowId, "Step1", 1, "mock-model", { input: 100, output: 50, totalTokens: 150, cost: 0.01 });

      // Call createDiagnostics again — should NOT overwrite
      createDiagnostics(cwd, workflowId, "My Workflow");

      const data = readDiagnostics(cwd, workflowId)!;
      expect(data.steps).toHaveLength(1);
      expect(data.steps[0].tokens.input).toBe(100);
    });
  });

  describe("recordStepUsage", () => {
    it("creates a new step entry and accumulates usage", () => {
      const cwd = makeTempDir();
      const workflowId = "test-wf-002";
      createDiagnostics(cwd, workflowId, "Test WF");

      const usage: TokenUsage = { input: 100, output: 50, totalTokens: 150, cost: 0.01 };
      recordStepUsage(cwd, workflowId, "Step1", 1, "mock-model", usage);

      const data = readDiagnostics(cwd, workflowId)!;
      expect(data.steps).toHaveLength(1);
      expect(data.steps[0]).toEqual({
        name: "Step1",
        execution: 1,
        model: "mock-model",
        tokens: { input: 100, output: 50, totalTokens: 150, cost: 0.01 },
      });
      expect(data.totals).toEqual({ input: 100, output: 50, totalTokens: 150, cost: 0.01 });
    });

    it("accumulates multiple turns into the same step entry", () => {
      const cwd = makeTempDir();
      const workflowId = "test-wf-003";
      createDiagnostics(cwd, workflowId, "Test WF");

      recordStepUsage(cwd, workflowId, "Step1", 1, "mock-model", { input: 100, output: 50, totalTokens: 150, cost: 0.01 });
      recordStepUsage(cwd, workflowId, "Step1", 1, "mock-model", { input: 200, output: 80, totalTokens: 280, cost: 0.02 });

      const data = readDiagnostics(cwd, workflowId)!;
      expect(data.steps).toHaveLength(1);
      expect(data.steps[0].tokens).toEqual({ input: 300, output: 130, totalTokens: 430, cost: 0.03 });
      expect(data.totals).toEqual({ input: 300, output: 130, totalTokens: 430, cost: 0.03 });
    });

    it("tracks separate entries for different executions of same step", () => {
      const cwd = makeTempDir();
      const workflowId = "test-wf-004";
      createDiagnostics(cwd, workflowId, "Test WF");

      recordStepUsage(cwd, workflowId, "DoWork", 1, "mock-model", { input: 100, output: 50, totalTokens: 150, cost: 0.01 });
      recordStepUsage(cwd, workflowId, "DoWork", 2, "mock-model", { input: 200, output: 80, totalTokens: 280, cost: 0.02 });

      const data = readDiagnostics(cwd, workflowId)!;
      expect(data.steps).toHaveLength(2);
      expect(data.steps[0].execution).toBe(1);
      expect(data.steps[1].execution).toBe(2);
      expect(data.totals).toEqual({ input: 300, output: 130, totalTokens: 430, cost: 0.03 });
    });

    it("does nothing if diagnostics file does not exist", () => {
      const cwd = makeTempDir();
      // No createDiagnostics called — should not throw
      recordStepUsage(cwd, "nonexistent", "Step1", 1, "mock-model", { input: 100, output: 50, totalTokens: 150, cost: 0.01 });
      expect(readDiagnostics(cwd, "nonexistent")).toBeNull();
    });
  });

  describe("completeDiagnostics", () => {
    it("sets status to completed with a timestamp", () => {
      const cwd = makeTempDir();
      const workflowId = "test-wf-005";
      createDiagnostics(cwd, workflowId, "Test WF");
      recordStepUsage(cwd, workflowId, "Step1", 1, "mock-model", { input: 100, output: 50, totalTokens: 150, cost: 0.01 });

      completeDiagnostics(cwd, workflowId, "completed");

      const data = readDiagnostics(cwd, workflowId)!;
      expect(data.status).toBe("completed");
      expect(data.completedAt).toBeTruthy();
      expect(data.totals).toEqual({ input: 100, output: 50, totalTokens: 150, cost: 0.01 });
    });

    it("sets status to aborted", () => {
      const cwd = makeTempDir();
      const workflowId = "test-wf-006";
      createDiagnostics(cwd, workflowId, "Test WF");

      completeDiagnostics(cwd, workflowId, "aborted");

      const data = readDiagnostics(cwd, workflowId)!;
      expect(data.status).toBe("aborted");
      expect(data.completedAt).toBeTruthy();
    });

    it("does nothing if diagnostics file does not exist", () => {
      const cwd = makeTempDir();
      // Should not throw
      completeDiagnostics(cwd, "nonexistent", "completed");
      expect(readDiagnostics(cwd, "nonexistent")).toBeNull();
    });
  });

  describe("extractUsageFromMessage", () => {
    it("extracts usage from an assistant message", () => {
      const message = {
        role: "assistant",
        usage: {
          input: 1000,
          output: 500,
          cacheRead: 200,
          cacheWrite: 100,
          totalTokens: 1500,
          cost: { input: 0.01, output: 0.005, cacheRead: 0.001, cacheWrite: 0.001, total: 0.017 },
        },
      };

      const result = extractUsageFromMessage(message);
      expect(result).toEqual({ input: 1000, output: 500, totalTokens: 1500, cost: 0.017 });
    });

    it("returns null for non-assistant messages", () => {
      expect(extractUsageFromMessage({ role: "user" })).toBeNull();
      expect(extractUsageFromMessage(null)).toBeNull();
      expect(extractUsageFromMessage(undefined)).toBeNull();
    });

    it("returns null for assistant message without usage", () => {
      expect(extractUsageFromMessage({ role: "assistant" })).toBeNull();
    });
  });
});
