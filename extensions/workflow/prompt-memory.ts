import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readKey, writeKey } from "../memory/store.js";
import { MEMORY_DIR } from "../shared/paths.js";

export const WORKFLOW_PROMPT_KEY = "workflow-prompt";

export function createMemoryDomain(cwd: string, domain: string): void {
  const dir = join(cwd, MEMORY_DIR);
  const filePath = join(dir, `${domain}.json`);
  if (existsSync(filePath)) return;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString();
  writeFileSync(
    filePath,
    JSON.stringify(
      {
        metadata: { created: ts, last_updated: ts, last_visited: ts },
        entries: {},
      },
      null,
      2,
    ),
    "utf-8",
  );
}

export function setWorkflowPrompt(cwd: string, workflowId: string, prompt: string): void {
  writeKey(cwd, workflowId, WORKFLOW_PROMPT_KEY, prompt);
}

export function getWorkflowPrompt(cwd: string, workflowId: string): string {
  const prompt = readKey(cwd, workflowId, WORKFLOW_PROMPT_KEY);
  if (prompt == null) {
    throw new Error(`Missing workflow prompt in memory for workflow ${workflowId}`);
  }
  return prompt;
}
