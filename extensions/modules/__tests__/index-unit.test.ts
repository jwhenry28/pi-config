import { describe, it, expect, vi } from "vitest";
import modulesExtension from "../index.js";
import { moduleTag, UNTAGGED_MODULE } from "../api.js";

function makeMockPi() {
  const commands = new Map<string, any>();
  const listeners = new Map<string, Function[]>();
  const activeTools: string[][] = [];
  const notifications: string[] = [];

  const events: any = {
    emit: (event: string, data: any) => {
      for (const handler of listeners.get(event) ?? []) handler(data);
    },
    on: (event: string, handler: Function) => {
      const list = listeners.get(event) ?? [];
      list.push(handler);
      listeners.set(event, list);
    },
  };

  const pi: any = {
    registerCommand: (name: string, command: any) => commands.set(name, command),
    getAllTools: () => [{ name: "pause_workflow" }, { name: "ask_user" }],
    setActiveTools: (names: string[]) => activeTools.push(names),
    on: (event: string, handler: Function) => {
      const list = listeners.get(event) ?? [];
      list.push(handler);
      listeners.set(event, list);
      return { dispose: vi.fn() };
    },
    events,
  };

  const ctx: any = {
    cwd: process.cwd(),
    ui: {
      notify: (message: string) => notifications.push(message),
      theme: { fg: (_color: string, text: string) => text },
    },
  };

  return { pi, commands, activeTools, notifications, ctx };
}

describe("modulesExtension UNTAGGED visibility", () => {
  it("omits UNTAGGED from module name completions", () => {
    const { pi, commands } = makeMockPi();
    moduleTag(pi, UNTAGGED_MODULE, { name: "pause_workflow" } as any);
    moduleTag(pi, "ask", { name: "ask_user" } as any);
    modulesExtension(pi);
    const moduleCommand = commands.get("module");

    expect(moduleCommand.getArgumentCompletions("show UN")).toBe(null);
    expect(moduleCommand.getArgumentCompletions("show a")).toEqual([{ value: "show ask", label: "ask" }]);
  });

  it("omits UNTAGGED from /module list output", async () => {
    const { pi, commands, notifications, ctx } = makeMockPi();
    moduleTag(pi, UNTAGGED_MODULE, { name: "pause_workflow" } as any);
    moduleTag(pi, "ask", { name: "ask_user" } as any);
    modulesExtension(pi);

    await commands.get("module").handler("list", ctx);

    expect(notifications.at(-1)).toContain("ask");
    expect(notifications.at(-1)).not.toContain(UNTAGGED_MODULE);
  });
});
