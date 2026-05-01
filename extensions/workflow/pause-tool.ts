import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { moduleTag, UNTAGGED_MODULE } from "../modules/api.js";
import type { WorkflowState } from "./types.js";

export const PAUSE_WORKFLOW_TOOL = "pause_workflow";

export interface PauseWorkflowParams {
  reason: string;
}

export async function executePauseWorkflow(
  state: WorkflowState,
  ctx: ExtensionContext,
  params: PauseWorkflowParams,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  if (!state.active) {
    return {
      content: [{ type: "text", text: "No workflow is active, so there is nothing to pause." }],
    };
  }

  const reason = normalizePauseReason(params.reason);
  state.errorPaused = true;
  notifyWorkflowPaused(ctx, reason);

  return {
    content: [
      {
        type: "text",
        text: `The workflow is paused: ${reason}. Please stop and wait for the user. The user can chat as needed, then run /workflow continue to retry this workflow step from the beginning or /workflow abort to cancel.`,
      },
    ],
  };
}

function normalizePauseReason(reason: string): string {
  return reason.trim() || "No reason provided";
}

function notifyWorkflowPaused(ctx: ExtensionContext, reason: string): void {
  ctx.ui.notify(
    `⏸️ Workflow paused: ${reason}. Chat with the agent as needed, then use /workflow continue to retry this step or /workflow abort to cancel.`,
    "warning",
  );
}

export function registerPauseWorkflowTool(
  pi: ExtensionAPI,
  state: WorkflowState,
): void {
  pi.registerTool(
    moduleTag(pi, UNTAGGED_MODULE, {
      name: PAUSE_WORKFLOW_TOOL,
      label: "Pause Workflow",
      description:
        "Pause the active workflow when you need human advice, clarification, or blocker resolution before completing the current workflow step.",
      promptGuidelines: [
        "Use this only during workflow steps when human advice, clarification, or blocker resolution is required before you can complete the step.",
        "Do not ask the blocker question as normal assistant text; call pause_workflow with a concise reason instead.",
        "After calling this tool, stop and wait for the user.",
      ],
      parameters: Type.Object({
        reason: Type.String({
          description: "Clear reason the workflow must pause for human advice or blocker resolution.",
          minLength: 1,
        }),
      }),
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        return executePauseWorkflow(state, ctx, params as PauseWorkflowParams);
      },
    }),
  );
}
