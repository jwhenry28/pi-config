import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { clearCwdOverride, setCwdOverride } from "../../shared/cwd.js";

const { executePythonToolMock } = vi.hoisted(() => ({
  executePythonToolMock: vi.fn(),
}));

vi.mock("../runtime.js", () => ({
  executePythonTool: executePythonToolMock,
}));

const tempDirs: string[] = [];

function makeTempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "rosetta-command-test-"));
  tempDirs.push(dir);
  return dir;
}

function makeMockPi() {
  const commands = new Map<string, any>();
  const handlers = new Map<string, Function>();

  return {
    pi: {
      registerTool: vi.fn(),
      registerCommand: vi.fn((name: string, command: any) => commands.set(name, command)),
      on: vi.fn((event: string, handler: Function) => {
        handlers.set(event, handler);
        return { dispose: () => {} };
      }),
      events: { emit: vi.fn() },
      sendMessage: vi.fn(),
    },
    commands,
    handlers,
  };
}

function writeCompsheetFixture(projectDir: string) {
  const extensionDir = join(projectDir, ".pi", "extensions", "rosetta", "extensions", "real-estate");
  mkdirSync(extensionDir, { recursive: true });
  writeFileSync(
    join(extensionDir, "config.yml"),
    `name: real-estate
module: real-estate
executor: python3
entrypoint: ./main.py
tools:
  - name: query_realtor_api
    description: Query realtor.com
    argv:
      - query
    input_schema:
      type: object
  - name: compsheet_new
    description: Create a compsheet
    argv:
      - compsheet
      - new
    input_schema:
      type: object
commands:
  - name: compsheet
    description: Manage compsheets
    subcommands:
      - name: new
        description: Create a compsheet
        argv:
          - compsheet
          - new
        input_schema:
          type: object
          properties:
            name:
              type: string
            full:
              type: boolean
          additionalProperties: false
          required:
            - name
`,
  );
  writeFileSync(join(extensionDir, "main.py"), "print('ok')\n");
  return join(extensionDir, "main.py");
}

async function startRosetta(projectDir: string) {
  setCwdOverride(projectDir);
  const { default: rosettaExtension } = await import("../index.js");
  const { pi, commands, handlers } = makeMockPi();
  const notifications: Array<{ msg: string; level: string }> = [];

  rosettaExtension(pi as any);
  await handlers.get("session_start")?.({}, {
    cwd: projectDir,
    ui: {
      notify: (msg: string, level: string) => notifications.push({ msg, level }),
    },
  });

  return { pi, commands, notifications };
}

afterEach(() => {
  clearCwdOverride();
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
  vi.clearAllMocks();
  vi.resetModules();
});

describe("Rosetta argv mapping", () => {
  it("executes tools with their configured argv mapping", async () => {
    const projectDir = makeTempProject();
    const entrypoint = writeCompsheetFixture(projectDir);
    const { pi } = await startRosetta(projectDir);
    executePythonToolMock.mockResolvedValue("ok");

    const registeredTools = (pi.registerTool as any).mock.calls.map((call: any[]) => call[0]);
    const queryTool = registeredTools.find((tool: any) => tool.name === "query_realtor_api");
    const compsheetTool = registeredTools.find((tool: any) => tool.name === "compsheet_new");

    await queryTool.execute("tool-call-1", { address: "123 Main" });
    await compsheetTool.execute("tool-call-2", { name: "My Sheet" });

    expect(executePythonToolMock).toHaveBeenNthCalledWith(1, entrypoint, { address: "123 Main" }, ["query"], {
      throwOnJsonError: false,
    });
    expect(executePythonToolMock).toHaveBeenNthCalledWith(2, entrypoint, { name: "My Sheet" }, ["compsheet", "new"], {
      throwOnJsonError: false,
    });
  });
});

describe("Rosetta slash command parsing", () => {
  it("passes /compsheet new flag values to Python and notifies success", async () => {
    const projectDir = makeTempProject();
    const entrypoint = writeCompsheetFixture(projectDir);
    const { commands, notifications } = await startRosetta(projectDir);
    executePythonToolMock.mockResolvedValue(JSON.stringify({ name: "my-sheet", path: "/tmp/my-sheet.csv" }));

    await commands.get("compsheet").handler('new --name "My Sheet"', {
      ui: { notify: (msg: string, level: string) => notifications.push({ msg, level }) },
    });

    expect(executePythonToolMock).toHaveBeenCalledWith(entrypoint, { name: "My Sheet" }, ["compsheet", "new"]);
    expect(notifications).toContainEqual({ msg: 'Created "my-sheet" at /tmp/my-sheet.csv', level: "info" });
  });

  it("shows usage for empty args and help without calling Python", async () => {
    const projectDir = makeTempProject();
    writeCompsheetFixture(projectDir);
    const { commands, notifications } = await startRosetta(projectDir);

    await commands.get("compsheet").handler("", {
      ui: { notify: (msg: string, level: string) => notifications.push({ msg, level }) },
    });
    await commands.get("compsheet").handler("help", {
      ui: { notify: (msg: string, level: string) => notifications.push({ msg, level }) },
    });

    expect(executePythonToolMock).not.toHaveBeenCalled();
    expect(notifications).toHaveLength(2);
    expect(notifications.every((notification) => notification.level === "info")).toBe(true);
    expect(notifications[0].msg).toContain("new --name <name> [--full <full>]");
  });

  it("warns for unknown subcommands and positional command input without calling Python", async () => {
    const projectDir = makeTempProject();
    writeCompsheetFixture(projectDir);
    const { commands, notifications } = await startRosetta(projectDir);

    await commands.get("compsheet").handler("delete Old Sheet", {
      ui: { notify: (msg: string, level: string) => notifications.push({ msg, level }) },
    });
    await commands.get("compsheet").handler("new My Sheet", {
      ui: { notify: (msg: string, level: string) => notifications.push({ msg, level }) },
    });

    expect(executePythonToolMock).not.toHaveBeenCalled();
    expect(notifications).toEqual([
      expect.objectContaining({ level: "warning", msg: expect.stringContaining("Unknown subcommand: delete") }),
      expect.objectContaining({ level: "warning", msg: expect.stringContaining("Unexpected positional argument: My") }),
    ]);
  });

  it("warns with Python-level errors", async () => {
    const projectDir = makeTempProject();
    writeCompsheetFixture(projectDir);
    const { commands, notifications } = await startRosetta(projectDir);
    executePythonToolMock.mockRejectedValue(new Error("Rosetta Python tool error: Compsheet already exists: /tmp/x.csv"));

    await commands.get("compsheet").handler("new --name Existing", {
      ui: { notify: (msg: string, level: string) => notifications.push({ msg, level }) },
    });

    expect(notifications).toContainEqual({
      msg: "Rosetta Python tool error: Compsheet already exists: /tmp/x.csv",
      level: "warning",
    });
  });
});
