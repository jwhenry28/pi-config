import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DIAGNOSTICS_DIR = ".pi-config/workflow-diagnostics";

// --- Types ---

export interface TokenUsage {
  input: number;
  output: number;
  totalTokens: number;
  cost: number;
}

export interface StepDiagnostic {
  name: string;
  execution: number;
  model: string;
  tokens: TokenUsage;
}

export interface WorkflowDiagnostics {
  workflowName: string;
  startedAt: string;
  completedAt: string | null;
  status: "running" | "completed" | "aborted";
  steps: StepDiagnostic[];
  totals: TokenUsage;
}

// --- Public API ---

export function createDiagnostics(cwd: string, workflowId: string, workflowName: string): void {
  const existing = readDiagnostics(cwd, workflowId);
  if (existing) return;

  const data: WorkflowDiagnostics = {
    workflowName,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: "running",
    steps: [],
    totals: zeroCounts(),
  };
  writeDiagnostics(cwd, workflowId, data);
}

export function readDiagnostics(cwd: string, workflowId: string): WorkflowDiagnostics | null {
  const p = diagnosticsPath(cwd, workflowId);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as WorkflowDiagnostics;
}

export function recordStepUsage(
  cwd: string,
  workflowId: string,
  stepName: string,
  execution: number,
  model: string,
  usage: TokenUsage,
): void {
  const data = readDiagnostics(cwd, workflowId);
  if (!data) return;

  let entry = data.steps.find((s) => s.name === stepName && s.execution === execution);
  if (!entry) {
    entry = { name: stepName, execution, model, tokens: zeroCounts() };
    data.steps.push(entry);
  }

  // Accumulate (multi-turn tool-use loops fire multiple turn_end events per execution)
  entry.tokens.input += usage.input;
  entry.tokens.output += usage.output;
  entry.tokens.totalTokens += usage.totalTokens;
  entry.tokens.cost = roundCost(entry.tokens.cost + usage.cost);

  data.totals = recomputeTotals(data.steps);
  writeDiagnostics(cwd, workflowId, data);
}

export function completeDiagnostics(
  cwd: string,
  workflowId: string,
  status: "completed" | "aborted",
): void {
  const data = readDiagnostics(cwd, workflowId);
  if (!data) return;

  data.completedAt = new Date().toISOString();
  data.status = status;
  data.totals = recomputeTotals(data.steps);
  writeDiagnostics(cwd, workflowId, data);
}

export function extractUsageFromMessage(message: any): TokenUsage | null {
  if (!message || message.role !== "assistant" || !message.usage) return null;
  const u = message.usage;
  return {
    input: u.input ?? 0,
    output: u.output ?? 0,
    totalTokens: u.totalTokens ?? 0,
    cost: u.cost?.total ?? 0,
  };
}

// --- Helpers ---

function diagnosticsPath(cwd: string, workflowId: string): string {
  return join(cwd, DIAGNOSTICS_DIR, `${workflowId}.json`);
}

function zeroCounts(): TokenUsage {
  return { input: 0, output: 0, totalTokens: 0, cost: 0 };
}

function writeDiagnostics(cwd: string, workflowId: string, data: WorkflowDiagnostics): void {
  const dir = join(cwd, DIAGNOSTICS_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(diagnosticsPath(cwd, workflowId), JSON.stringify(data, null, 2), "utf-8");
}

function roundCost(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

function recomputeTotals(steps: StepDiagnostic[]): TokenUsage {
  const totals = zeroCounts();
  for (const s of steps) {
    totals.input += s.tokens.input;
    totals.output += s.tokens.output;
    totals.totalTokens += s.tokens.totalTokens;
    totals.cost += s.tokens.cost;
  }
  totals.cost = roundCost(totals.cost);
  return totals;
}
