import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import rosettaExtension from "../index.js";
import { loadRosettaExtensions } from "../config.js";
import { clearCwdOverride, setCwdOverride } from "../../shared/cwd.js";

const tempDirs: string[] = [];

function makeTempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "rosetta-test-"));
  tempDirs.push(dir);
  return dir;
}

function makeMockPi() {
  const tools = new Map<string, any>();
  const commands = new Map<string, any>();
  const blockedToolNames = new Set<string>();
  const blockedCommandNames = new Set<string>();
  const registerTool = vi.fn((tool: any) => {
    const isBlocked = blockedToolNames.has(tool.name);
    if (isBlocked) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }

    const isDuplicate = tools.has(tool.name);
    if (isDuplicate) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }

    tools.set(tool.name, tool);
  });
  const registerCommand = vi.fn((name: string, command: any) => {
    const isBlocked = blockedCommandNames.has(name);
    if (isBlocked) {
      throw new Error(`Command already registered: ${name}`);
    }

    const isDuplicate = commands.has(name);
    if (isDuplicate) {
      throw new Error(`Command already registered: ${name}`);
    }

    commands.set(name, command);
  });

  const handlers = new Map<string, Function>();

  return {
    pi: {
      registerTool,
      registerCommand,
      on: vi.fn((event: string, handler: Function) => {
        handlers.set(event, handler);
        return { dispose: () => {} };
      }),
      events: { emit: vi.fn() },
      sendMessage: vi.fn(),
    },
    tools,
    commands,
    registerTool,
    registerCommand,
    handlers,
    blockedToolNames,
    blockedCommandNames,
  };
}

function writeHelloFixture(projectDir: string, extensionName = "hello-python", toolName = "hello_python") {
  const extensionDir = join(projectDir, ".pi", "extensions", "rosetta", "extensions", extensionName);
  mkdirSync(extensionDir, { recursive: true });
  writeFileSync(
    join(extensionDir, "config.yml"),
    `name: ${extensionName}\nexecutor: python3\nentrypoint: ./main.py\ntools:\n  - name: ${toolName}\n    description: Say hello from Python\n    input_schema:\n      type: object\n      properties:\n        name:\n          type: string\n      additionalProperties: false\n`,
  );
  writeFileSync(join(extensionDir, "main.py"), "print('ok')\n");
}

function writeCompsheetCommandFixture(projectDir: string, extensionName = "real-estate", commandName = "compsheet") {
  const extensionDir = join(projectDir, ".pi", "extensions", "rosetta", "extensions", extensionName);
  mkdirSync(extensionDir, { recursive: true });
  writeFileSync(
    join(extensionDir, "config.yml"),
    `name: ${extensionName}\nexecutor: python3\nentrypoint: ./main.py\ntools:\n  - name: compsheet_new_${extensionName}\n    description: Create a compsheet\n    argv:\n      - compsheet\n      - new\n    input_schema:\n      type: object\ncommands:\n  - name: ${commandName}\n    description: Manage compsheets\n    subcommands:\n      - name: new\n        description: Create a compsheet\n        argv:\n          - compsheet\n          - new\n        rest_parameter: name\n        usage: "Usage: /${commandName} new <name>"\n`,
  );
  writeFileSync(join(extensionDir, "main.py"), "print('ok')\n");
}

afterEach(() => {
  clearCwdOverride();
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
  vi.restoreAllMocks();
});

describe("loadRosettaExtensions", () => {
  it("loads a valid foreign extension", () => {
    const projectDir = makeTempProject();
    writeHelloFixture(projectDir);

    const result = loadRosettaExtensions(projectDir);

    expect(result.warnings).toEqual([]);
    expect(result.extensions).toHaveLength(1);
    expect(result.extensions[0].name).toBe("hello-python");
    expect(result.extensions[0].entrypoint).toBe(
      join(projectDir, ".pi", "extensions", "rosetta", "extensions", "hello-python", "main.py"),
    );
    expect(result.extensions[0].tools[0].name).toBe("hello_python");
  });

  it("warns and skips invalid YAML", () => {
    const projectDir = makeTempProject();
    const extensionDir = join(projectDir, ".pi", "extensions", "rosetta", "extensions", "broken");
    mkdirSync(extensionDir, { recursive: true });
    writeFileSync(join(extensionDir, "config.yml"), "name: [unterminated\n");

    const result = loadRosettaExtensions(projectDir);

    expect(result.extensions).toHaveLength(0);
    expect(result.warnings[0]).toContain("failed to parse");
  });

  it("warns and skips unsupported executors", () => {
    const projectDir = makeTempProject();
    const extensionDir = join(projectDir, ".pi", "extensions", "rosetta", "extensions", "bad-executor");
    mkdirSync(extensionDir, { recursive: true });
    writeFileSync(
      join(extensionDir, "config.yml"),
      "name: bad-executor\nexecutor: python\nentrypoint: ./main.py\ntools:\n  - name: hello_python\n    description: Say hello\n    input_schema:\n      type: object\n",
    );

    const result = loadRosettaExtensions(projectDir);

    expect(result.extensions).toHaveLength(0);
    expect(result.warnings[0]).toContain('executor must be exactly "python3"');
  });

  it("warns and skips entrypoints that escape the extension directory", () => {
    const projectDir = makeTempProject();
    const extensionDir = join(projectDir, ".pi", "extensions", "rosetta", "extensions", "escape");
    mkdirSync(extensionDir, { recursive: true });
    writeFileSync(
      join(extensionDir, "config.yml"),
      "name: escape\nexecutor: python3\nentrypoint: ../outside.py\ntools:\n  - name: hello_python\n    description: Say hello\n    input_schema:\n      type: object\n",
    );

    const result = loadRosettaExtensions(projectDir);

    expect(result.extensions).toHaveLength(0);
    expect(result.warnings[0]).toContain("Entrypoint must stay inside extension directory");
  });

  it("warns and skips missing tools arrays", () => {
    const projectDir = makeTempProject();
    const extensionDir = join(projectDir, ".pi", "extensions", "rosetta", "extensions", "missing-tools");
    mkdirSync(extensionDir, { recursive: true });
    writeFileSync(
      join(extensionDir, "config.yml"),
      "name: missing-tools\nexecutor: python3\nentrypoint: ./main.py\n",
    );

    const result = loadRosettaExtensions(projectDir);

    expect(result.extensions).toHaveLength(0);
    expect(result.warnings[0]).toContain("tools must be a non-empty array");
  });

  it("keeps tool-only configs backward compatible", () => {
    const projectDir = makeTempProject();
    writeHelloFixture(projectDir);

    const result = loadRosettaExtensions(projectDir);

    expect(result.warnings).toEqual([]);
    expect(result.extensions[0].commands).toEqual([]);
    expect(result.extensions[0].tools[0].argv).toEqual([]);
  });

  it("loads valid command declarations", () => {
    const projectDir = makeTempProject();
    writeCompsheetCommandFixture(projectDir);

    const result = loadRosettaExtensions(projectDir);

    expect(result.warnings).toEqual([]);
    expect(result.extensions[0].commands[0]).toEqual({
      name: "compsheet",
      description: "Manage compsheets",
      subcommands: [
        {
          name: "new",
          description: "Create a compsheet",
          argv: ["compsheet", "new"],
          rest_parameter: "name",
          usage: "Usage: /compsheet new <name>",
        },
      ],
    });
  });

  it("warns and skips invalid command declarations", () => {
    const projectDir = makeTempProject();
    const extensionDir = join(projectDir, ".pi", "extensions", "rosetta", "extensions", "bad-command");
    mkdirSync(extensionDir, { recursive: true });
    writeFileSync(
      join(extensionDir, "config.yml"),
      "name: bad-command\nexecutor: python3\nentrypoint: ./main.py\ntools:\n  - name: hello_python\n    description: Say hello\n    input_schema:\n      type: object\ncommands:\n  - name: compsheet\n    description: Manage compsheets\n",
    );

    const result = loadRosettaExtensions(projectDir);

    expect(result.extensions).toHaveLength(0);
    expect(result.warnings[0]).toContain('command "compsheet" must have a non-empty subcommands array');
  });
});

describe("rosettaExtension", () => {
  it("registers discovered tools on session start", async () => {
    const projectDir = makeTempProject();
    writeHelloFixture(projectDir);
    setCwdOverride(projectDir);

    const notifications: Array<{ msg: string; level: string }> = [];
    const { pi, tools, handlers } = makeMockPi();
    rosettaExtension(pi as any);

    const sessionStart = handlers.get("session_start");
    expect(sessionStart).toBeTypeOf("function");

    await sessionStart?.({}, {
      cwd: projectDir,
      ui: {
        notify: (msg: string, level: string) => notifications.push({ msg, level }),
      },
    });

    expect(tools.has("hello_python")).toBe(true);
    expect(notifications).toEqual([]);
  });

  it("registers discovered commands on session start", async () => {
    const projectDir = makeTempProject();
    writeCompsheetCommandFixture(projectDir);
    setCwdOverride(projectDir);

    const notifications: Array<{ msg: string; level: string }> = [];
    const { pi, commands, handlers } = makeMockPi();
    rosettaExtension(pi as any);

    const sessionStart = handlers.get("session_start");
    await sessionStart?.({}, {
      cwd: projectDir,
      ui: {
        notify: (msg: string, level: string) => notifications.push({ msg, level }),
      },
    });

    expect(commands.has("compsheet")).toBe(true);
    expect(commands.get("compsheet").description).toBe("Manage compsheets");
    expect(notifications).toEqual([]);
  });

  it("warns and skips duplicate tool names across Rosetta configs", async () => {
    const projectDir = makeTempProject();
    writeHelloFixture(projectDir, "hello-one", "hello_python");
    writeHelloFixture(projectDir, "hello-two", "hello_python");
    setCwdOverride(projectDir);

    const notifications: Array<{ msg: string; level: string }> = [];
    const { pi, tools, handlers } = makeMockPi();
    rosettaExtension(pi as any);

    const sessionStart = handlers.get("session_start");
    await sessionStart?.({}, {
      cwd: projectDir,
      ui: {
        notify: (msg: string, level: string) => notifications.push({ msg, level }),
      },
    });

    expect(tools.has("hello_python")).toBe(true);
    expect(notifications.some((notification) => notification.msg.includes('skipping duplicate tool "hello_python"'))).toBe(true);
  });

  it("warns and skips duplicate command names across Rosetta configs", async () => {
    const projectDir = makeTempProject();
    writeCompsheetCommandFixture(projectDir, "real-estate-one", "compsheet");
    writeCompsheetCommandFixture(projectDir, "real-estate-two", "compsheet");
    setCwdOverride(projectDir);

    const notifications: Array<{ msg: string; level: string }> = [];
    const { pi, commands, handlers } = makeMockPi();
    rosettaExtension(pi as any);

    const sessionStart = handlers.get("session_start");
    await sessionStart?.({}, {
      cwd: projectDir,
      ui: {
        notify: (msg: string, level: string) => notifications.push({ msg, level }),
      },
    });

    expect(commands.has("compsheet")).toBe(true);
    expect(notifications.some((notification) => notification.msg.includes('skipping duplicate command "/compsheet"'))).toBe(true);
  });

  it("warns when pi rejects a conflicting tool registration", async () => {
    const projectDir = makeTempProject();
    writeHelloFixture(projectDir);
    setCwdOverride(projectDir);

    const notifications: Array<{ msg: string; level: string }> = [];
    const { pi, handlers, blockedToolNames } = makeMockPi();
    blockedToolNames.add("hello_python");
    rosettaExtension(pi as any);

    const sessionStart = handlers.get("session_start");
    await sessionStart?.({}, {
      cwd: projectDir,
      ui: {
        notify: (msg: string, level: string) => notifications.push({ msg, level }),
      },
    });

    expect(notifications.some((notification) => notification.msg.includes("registration failed"))).toBe(true);
  });

  it("loads only once even if session_start fires twice", async () => {
    const projectDir = makeTempProject();
    writeHelloFixture(projectDir);
    setCwdOverride(projectDir);

    const { pi, registerTool, handlers } = makeMockPi();
    rosettaExtension(pi as any);

    const sessionStart = handlers.get("session_start");
    const ctx = {
      cwd: projectDir,
      ui: {
        notify: vi.fn(),
      },
    };

    await sessionStart?.({}, ctx);
    await sessionStart?.({}, ctx);

    expect(registerTool).toHaveBeenCalledTimes(1);
  });
});
