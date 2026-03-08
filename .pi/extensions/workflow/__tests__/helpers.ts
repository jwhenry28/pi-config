import type { ComponentTestSession } from "../../testutils/component/index.js";
import { createDummyModel } from "../../testutils/component/mock-stream.js";

/**
 * Register the mock model in the session's model registry so workflow
 * steps can look it up by ID, and add a dummy API key.
 */
export function registerMockModel(test: ComponentTestSession): void {
  const registry = test.session.modelRegistry as any;
  const model = createDummyModel();
  if (Array.isArray(registry.models)) {
    const alreadyExists = registry.models.some((m: any) => m.id === model.id);
    if (!alreadyExists) {
      registry.models.push(model);
    }
  }
  registry.authStorage.setRuntimeApiKey(model.provider, "mock-api-key");
}

/**
 * Run a workflow via runCommand, then provide mock responses for any
 * remaining steps that didn't get auto-responded.
 *
 * runCommand auto-responds to steps that start during its active window,
 * but autoAdvance setTimeout(0) chains can outrun the drain window,
 * leaving some steps waiting for responses.
 */
export async function runWorkflow(
  test: ComponentTestSession,
  command: string,
  expectedSteps: number,
): Promise<void> {
  await test.runCommand(command);
  // Allow any in-flight autoAdvance to fire
  await new Promise(r => setTimeout(r, 50));

  // Check how many steps completed, provide responses for the rest
  for (let attempt = 0; attempt < expectedSteps; attempt++) {
    const markers = test.events.customMessages("workflow:step-marker");
    const agentEnds = test.events.ofType("agent_end");
    if (agentEnds.length >= markers.length) break;

    // A step started but hasn't gotten a response
    await test.mockAgentResponse({ text: "" });
    await new Promise(r => setTimeout(r, 50));
  }

  await test.waitForIdle();
  // Final drain for completion notification
  await new Promise(r => setTimeout(r, 100));
}
