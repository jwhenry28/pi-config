import { describe, it, expect } from "vitest";
import {
  applyStepModules,
  captureActiveTools,
  restoreOriginalActiveTools,
  shouldSkipPostStepForPause,
} from "../runner.js";
import { PAUSE_WORKFLOW_TOOL } from "../pause-tool.js";
import { UNTAGGED_MODULE } from "../../modules/api.js";
import type { WorkflowState } from "../types.js";

function makePi() {
  const activeTools: string[][] = [];
  return {
    activeTools,
    pi: {
      getAllTools: () => [
        { name: "ask_user" },
        { name: "memory_get" },
        { name: PAUSE_WORKFLOW_TOOL },
      ],
      setActiveTools: (names: string[]) => activeTools.push(names),
      events: {
        emit: (event: string, data: any) => {
          if (event !== "module:get-state") return;
          data.callback({
            shown: ["memory"],
            modules: new Map([
              ["ask", { skills: [], tools: ["ask_user"] }],
              ["memory", { skills: [], tools: ["memory_get"] }],
              [UNTAGGED_MODULE, { skills: [], tools: [PAUSE_WORKFLOW_TOOL] }],
            ]),
          });
        },
      },
    } as any,
  };
}

function makeState(originalActiveTools: string[] | null): WorkflowState {
  return {
    active: null,
    allSkills: [],
    cwd: "",
    advancing: false,
    savedCommandCtx: null,
    originalModelId: null,
    originalThinkingLevel: null,
    originalActiveTools,
    pendingConditionIndex: null,
    errorPaused: false,
  };
}

describe("workflow pause tool activation", () => {
  it("captures original active tools before workflow-only pause tool is appended", () => {
    const { pi } = makePi();

    expect(captureActiveTools(pi)).toEqual(["memory_get"]);
  });

  it("appends pause_workflow exactly once for workflow prompt steps", () => {
    const { pi, activeTools } = makePi();
    const config = { name: "test", modules: ["ask"], steps: [] as any[] };
    const step = { name: "s", model: "m", prompt: "p", maxExecutions: 1 } as any;

    applyStepModules(pi, config, step);

    expect(activeTools).toEqual([["ask_user", PAUSE_WORKFLOW_TOOL]]);
  });

  it("does not duplicate pause_workflow when it is already present", () => {
    const { activeTools } = makePi();
    const pi: any = {
      getAllTools: () => [{ name: PAUSE_WORKFLOW_TOOL }],
      setActiveTools: (names: string[]) => activeTools.push(names),
      events: {
        emit: (_event: string, data: any) => {
          data.callback({
            shown: [UNTAGGED_MODULE],
            modules: new Map([[UNTAGGED_MODULE, { skills: [], tools: [PAUSE_WORKFLOW_TOOL] }]]),
          });
        },
      },
    };

    applyStepModules(pi, { name: "test", steps: [] }, { name: "s", model: "m", prompt: "p", maxExecutions: 1 } as any);

    expect(activeTools).toEqual([[PAUSE_WORKFLOW_TOOL]]);
  });

  it("restores original active tools without workflow-only additions", async () => {
    const { pi, activeTools } = makePi();
    const state = makeState(["memory_get"]);

    await restoreOriginalActiveTools(pi, state);

    expect(activeTools).toEqual([["memory_get"]]);
    expect(state.originalActiveTools).toBeNull();
  });

  it("skips post-step processing while an error/pause state is active", () => {
    const state = makeState(null);
    state.errorPaused = true;

    expect(shouldSkipPostStepForPause(state)).toBe(true);
  });
});
