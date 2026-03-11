import { vi } from "vitest";

type ToolImpl = {
  execute: (...args: any[]) => Promise<any>;
};

export function makeMockPi() {
  const tools = new Map<string, ToolImpl>();
  const registerMessageRenderer = vi.fn();

  return {
    pi: {
      registerTool: (tool: any) => tools.set(tool.name, tool),
      registerMessageRenderer,
      on: vi.fn(),
      events: { emit: vi.fn() },
      sendMessage: vi.fn(),
    },
    tools,
    registerMessageRenderer,
  };
}
