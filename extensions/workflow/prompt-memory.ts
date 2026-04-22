import { ensureStore, readKey, writeKey } from "../memory/store.js";

export const WORKFLOW_PROMPT_KEY = "workflow-prompt";

export function createMemoryDomain(cwd: string, domain: string): void {
  ensureStore(cwd, domain);
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
