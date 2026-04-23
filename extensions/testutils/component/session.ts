import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createAgentSession,
  SessionManager,
  type AgentSession,
  type ToolDefinition,
  type Tool,
  type UIFunctions,
} from "@mariozechner/pi-coding-agent";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { MockStreamController, createDummyModel, type ScriptedResponse } from "./mock-stream.js";
import { CollectedEvents } from "./events.js";
import { writeKey } from "../../memory/store.js";
import { setCwdOverride, clearCwdOverride } from "../../shared/cwd.js";
import { setHomeDirOverride, clearHomeDirOverride } from "../../shared/home.js";
import { writeSkill, writeWorkflow, writeConfigFile, writeGlobalPluginDir, writeTodo, writePrompt } from "../fixtures.js";

// ── Types ──────────────────────────────────────────────────────────

export interface SkillFixture {
  name: string;
  content: string;
}

export interface ConfigFixture {
  filename: string;
  content: string;
}

export interface PluginFixture {
  name: string;
  skills?: { name: string; content: string }[];
  prompts?: { name: string; content: string }[];
  workflows?: { name: string; config: object }[];
  /** Arbitrary files (escape hatch for non-standard content). */
  files?: { path: string; content: string }[];
}

export interface WorkflowFixture {
  name: string;
  config: object;
}

export interface PromptFixture {
  /** Prompt name, e.g. "my-prompt" or "pack/task" */
  name: string;
  content: string;
}

export interface TodoFixture {
  filepath: string;
  items: { text: string; checked: boolean }[];
}

export interface ComponentTestOptions {
  /** Skill fixtures to write before session_start loads skills. */
  initialSkills?: SkillFixture[];
  /** Config file fixtures to write before session_start. */
  initialConfigs?: ConfigFixture[];
  /** Plugin directory fixtures to write before session_start. */
  initialPlugins?: PluginFixture[];
  /** Workflow file fixtures to write before session_start. */
  initialWorkflows?: WorkflowFixture[];
  /** Todo file fixtures to write before session_start. */
  initialTodos?: TodoFixture[];
  /** Local prompt fixtures (.pi/prompts/) written before session_start. */
  initialPrompts?: PromptFixture[];
  /** Home-level prompt fixtures (~/.pi/prompts/) written before session_start. */
  initialHomePrompts?: PromptFixture[];
  /** Built-in tools to enable. Defaults to [] (no built-in tools). */
  tools?: Tool[];
  /** Extension-registered custom tools. */
  customTools?: ToolDefinition[];
  /** Pre-populated conversation context. */
  messages?: AgentMessage[];
  /** Module names to show. Defaults to all tool names (broad match). */
  shownModules?: string[];
}

export interface Notification {
  message: string;
  type: string;
}

interface ToolInvocationResult {
  toolName: string;
  result: unknown;
  isError: boolean;
}

export interface ComponentTestSession {
  /** The working directory for this test session (isolated temp dir). */
  cwd: string;
  /** The home directory for this test session (isolated temp dir, separate from cwd). */
  homeDir: string;
  /** The underlying AgentSession. */
  session: AgentSession;
  /** Collected session events for assertions. */
  events: CollectedEvents;
  /** All ui.notify() calls captured during the test. */
  notifications: Notification[];
  /**
   * Send a user message or slash command. Does NOT wait for the agent loop.
   * Slash commands execute synchronously. LLM prompts start the agent loop
   * which blocks until mockAgentResponse() provides responses.
   */
  sendUserMessage(text: string): void;
  /**
   * Run a slash command. If the command triggers agent turns internally
   * (e.g. via pi.sendUserMessage), they auto-complete with empty responses.
   * Awaitable — resolves when the command and any triggered turns finish.
   */
  runCommand(text: string): Promise<void>;
  /**
   * Wait until the next agent/model turn is actively pending.
   * Useful before calling mockAgentResponse() in orchestration-heavy tests.
   */
  waitForAgentTurn(timeoutMs?: number): Promise<void>;
  /**
   * Provide one scripted LLM response. Returns a promise that resolves once
   * the response is fully consumed (tools executed, agent either needs another
   * response or has gone idle).
   */
  mockAgentResponse(response: ScriptedResponse): Promise<void>;
  /**
   * Invoke a registered tool directly without starting an agent turn.
   * Prefer this for tests that validate tool behavior rather than orchestration.
   */
  invokeTool(name: string, args: Record<string, unknown>): Promise<ToolInvocationResult>;
  /**
   * Wait for the agent loop to fully wind down and events to drain.
   * Call after the final mockAgentResponse.
   */
  waitForIdle(): Promise<void>;
  /** Clean up the session. */
  dispose(): void;
}

// ── Factory ────────────────────────────────────────────────────────

export async function createComponentTest(
  options?: ComponentTestOptions
): Promise<ComponentTestSession> {
  const opts = options ?? {};
  // Always create an isolated temp dir for component test data.
  const projectCwd = process.cwd();
  const tempDir = mkdtempSync(join(tmpdir(), "pi-test-cwd-"));
  const tempHome = mkdtempSync(join(tmpdir(), "pi-test-home-"));

  // Extension discovery fallback for monorepo layout migrations:
  // If project-local extensions live in ./extensions (instead of ./.pi/extensions),
  // mirror them into tempDir/.pi/extensions via symlink so bindExtensions can find them.
  const projectPiExtensionsDir = join(projectCwd, ".pi", "extensions");
  const projectExtensionsDir = join(projectCwd, "extensions");
  const extensionSourceDir = existsSync(projectPiExtensionsDir)
    ? projectPiExtensionsDir
    : (existsSync(projectExtensionsDir) ? projectExtensionsDir : undefined);

  if (extensionSourceDir) {
    const tempPiDir = join(tempDir, ".pi");
    const tempPiExtensionsDir = join(tempPiDir, "extensions");
    mkdirSync(tempPiDir, { recursive: true });
    symlinkSync(extensionSourceDir, tempPiExtensionsDir, "dir");
  }

  // Use the temp dir as session cwd so extension discovery/resource loading
  // are isolated and deterministic across repository layouts.
  const cwd = tempDir;
  setCwdOverride(tempDir);
  setHomeDirOverride(tempHome);

  // Copy real project workflows and prompts into the temp dir.
  // For skills, copy only a small allowlist so component harness startup
  // doesn't pull in large embedded documentation trees from heavyweight skills.
  // initial* fixtures write AFTER this, so they can override or add on top.
  const piDirsToCopy = ["workflows", "prompts"] as const;
  for (const dir of piDirsToCopy) {
    const dotPiSource = join(projectCwd, ".pi", dir);
    const rootSource = join(projectCwd, dir);
    const source = existsSync(dotPiSource) ? dotPiSource : (existsSync(rootSource) ? rootSource : undefined);
    if (source) {
      const dest = join(tempDir, ".pi", dir);
      mkdirSync(dest, { recursive: true });
      cpSync(source, dest, { recursive: true });
    }
  }

  const skillsSource = existsSync(join(projectCwd, ".pi", "skills"))
    ? join(projectCwd, ".pi", "skills")
    : (existsSync(join(projectCwd, "skills")) ? join(projectCwd, "skills") : undefined);

  const allowedSkills = new Set([
    "brainstorming",
    "writing-plans",
    "executing-plans",
    "knowing-clean-code",
    "knowing-yagni",
    "knowing-dry",
  ]);

  if (skillsSource) {
    const tempSkillsDir = join(tempDir, ".pi", "skills");
    mkdirSync(tempSkillsDir, { recursive: true });

    for (const skillName of allowedSkills) {
      const source = join(skillsSource, skillName);
      if (!existsSync(source)) continue;
      const dest = join(tempSkillsDir, skillName);
      cpSync(source, dest, { recursive: true });
    }
  }

  // Write fixtures BEFORE bindExtensions (session_start → loadAllSkills)
  if (opts.initialSkills) {
    for (const s of opts.initialSkills) writeSkill(tempDir, s.name, s.content);
  }
  if (opts.initialConfigs) {
    for (const c of opts.initialConfigs) writeConfigFile(tempDir, c.filename, c.content);
  }
  if (opts.initialPlugins) {
    for (const p of opts.initialPlugins) writeGlobalPluginDir(p.name, p);
  }
  if (opts.initialWorkflows) {
    for (const w of opts.initialWorkflows) writeWorkflow(tempDir, w.name, w.config);
  }
  if (opts.initialTodos) {
    for (const t of opts.initialTodos) writeTodo(tempDir, t.filepath, t.items);
  }
  if (opts.initialPrompts) {
    for (const p of opts.initialPrompts) writePrompt(tempDir, p.name, p.content);
  }
  if (opts.initialHomePrompts) {
    for (const p of opts.initialHomePrompts) writePrompt(tempHome, p.name, p.content);
  }
  const model = createDummyModel();
  const controller = new MockStreamController();

  const { session } = await createAgentSession({
    cwd,
    model,
    sessionManager: SessionManager.inMemory(),
    ...(opts.tools ? { tools: opts.tools } : {}),
    customTools: opts.customTools,
  });

  // Override the agent's stream function with our mock
  session.agent.streamFn = controller.streamFn;
  session._modelRegistry.hasConfiguredAuth = () => true;

  // Pre-populate messages if provided
  if (opts.messages) {
    session.agent.replaceMessages(opts.messages);
  }

  // Collect events
  const events = new CollectedEvents();
  const unsubscribe = session.subscribe((event) => {
    events.push(event);
  });

  // Capture notifications
  const notifications: Notification[] = [];
  const registeredTools = new Map<string, ToolDefinition>();

  // Write module config BEFORE binding extensions, so the modules extension
  // reads the correct shownModules during session_start initialization.
  // Always write — even without shownModules — to clear any leftover config
  // from a previous test (vitest runs files in parallel).
  const shownModules = opts.shownModules ?? [];

  writeKey(tempDir, "pi-config", "pi-modules", JSON.stringify({ shown: shownModules, granular: {} }));

  const uiContext: UIFunctions = {
    select: async () => undefined,
    confirm: async () => false,
    input: async () => undefined,
    notify: (message: string, type?: string) => {
      notifications.push({ message, type: type ?? "info" });
    },
    onTerminalInput: () => () => {},
    setStatus: () => {},
    setWorkingMessage: () => {},
    setWidget: () => {},
    setFooter: () => {},
    setHeader: () => {},
    setTitle: () => {},
    custom: async () => undefined,
    pasteToEditor: () => {},
    setEditorText: () => {},
    theme: new Proxy({} as any, {
      get: (_target, prop) => {
        if (typeof prop === "string") {
          return (...args: any[]) => {
            const lastString = [...args].reverse().find((a) => typeof a === "string");
            return lastString ?? "";
          };
        }
        return undefined;
      },
    }),
  };

  // Bind extensions so slash commands work, with a UI context that captures notify calls
  await session.bindExtensions({ uiContext });

  const registeredToolEntries = session._toolRegistry?.entries();
  if (registeredToolEntries) {
    for (const [name, tool] of registeredToolEntries) {
      registeredTools.set(name, tool as ToolDefinition);
    }
  }

  // Watch for agent going idle to unblock controller
  session.subscribe((event: any) => {
    if (event.type === "agent_end") {
      controller.notifyIdle();
    }
  });

  function rethrowHarnessError(): void {
    const error = controller.consumePendingError();
    if (!error) {
      return;
    }

    throw error;
  }

  function sendUserMessage(text: string): void {
    if (text.startsWith("/")) {
      void runCommand(text);
      return;
    }

    void session.prompt(text);
  }

  async function runCommand(text: string): Promise<void> {
    controller.setAutoRespond(true);

    try {
      session.prompt(text);
      await session.agent.waitForIdle();
      await drainEventQueue();
      rethrowHarnessError();
    } finally {
      controller.setAutoRespond(false);
    }
  }

  async function waitForAgentTurn(timeoutMs: number = 5000): Promise<void> {
    await controller.waitForPendingTurn(timeoutMs);
    await drainEventQueue();
    rethrowHarnessError();
  }

  async function mockAgentResponse(response: ScriptedResponse): Promise<void> {
    await controller.provide(response);
    await drainEventQueue();
    rethrowHarnessError();
  }

  async function invokeTool(name: string, args: Record<string, unknown>): Promise<ToolInvocationResult> {
    const tool = registeredTools.get(name);
    if (!tool) {
      throw new Error(`Tool not found in component test session: ${name}`);
    }

    events.push({ type: "tool_execution_start", toolName: name, args });

    try {
      // Prefer invokeTool() for component tests that validate tool behavior.
      // This bypasses model prompting while still exercising the registered extension tool.
      const result = await tool.execute(
        "component-test-tool-call",
        args,
        new AbortController().signal,
        () => {},
        { session, ui: uiContext, hasUI: true } as any,
      );

      events.push({ type: "tool_execution_end", toolName: name, result, isError: false });
      await drainEventQueue();
      rethrowHarnessError();
      return { toolName: name, result, isError: false };
    } catch (error) {
      events.push({ type: "tool_execution_end", toolName: name, result: error, isError: true });
      await drainEventQueue();
      throw error;
    }
  }

  async function waitForIdle(): Promise<void> {
    await session.agent.waitForIdle();
    await drainEventQueue();
    rethrowHarnessError();
  }

  async function drainEventQueue(): Promise<void> {
    // session.agent.waitForIdle() resolves when the agent loop ends,
    // but event subscribers may still be processing. Yield with a
    // real timer delay so pending microtasks, I/O callbacks, and
    // chained promises from subscribers can settle.
    await new Promise<void>((r) => setTimeout(r, 5));
  }

  function dispose(): void {
    unsubscribe();
    session.dispose();
    clearCwdOverride();
    clearHomeDirOverride();
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    try { rmSync(tempHome, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  return {
    cwd: tempDir,
    homeDir: tempHome,
    session,
    events,
    notifications,
    sendUserMessage,
    runCommand,
    waitForAgentTurn,
    mockAgentResponse,
    invokeTool,
    waitForIdle,
    dispose,
  };
}
