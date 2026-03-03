# @mariozechner/pi-agent-core SDK Reference

Stateful agent with tool execution, event streaming, steering, and follow-ups. Built on `@mariozechner/pi-ai`.

## Table of Contents

- [Quick Start](#quick-start)
- [Agent Options](#agent-options)
- [Agent State](#agent-state)
- [Methods](#methods)
- [Event Flow](#event-flow)
- [Event Types](#event-types)
- [AgentMessage and Custom Types](#agentmessage-and-custom-types)
- [Tools](#tools)
- [Steering and Follow-ups](#steering-and-follow-ups)
- [Proxy Usage](#proxy-usage)
- [Low-Level API](#low-level-api)

## Quick Start

```typescript
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful assistant.",
    model: getModel("anthropic", "claude-sonnet-4-20250514"),
  },
});

agent.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await agent.prompt("Hello!");
```

## Agent Options

```typescript
const agent = new Agent({
  initialState: {
    systemPrompt: string,
    model: Model<any>,
    thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh",
    tools: AgentTool<any>[],
    messages: AgentMessage[],
  },

  // Required for custom message types: convert AgentMessage[] to LLM Message[]
  convertToLlm: (messages) => messages.filter(...),

  // Optional: transform context before LLM call (pruning, compaction)
  transformContext: async (messages, signal) => pruneOldMessages(messages),

  // Steering/follow-up modes: "one-at-a-time" (default) or "all"
  steeringMode: "one-at-a-time",
  followUpMode: "one-at-a-time",

  // Custom stream function (for proxy backends)
  streamFn: streamProxy,

  // Session ID for provider caching
  sessionId: "session-123",

  // Dynamic API key resolution
  getApiKey: async (provider) => refreshToken(),

  // Custom thinking budgets
  thinkingBudgets: { minimal: 128, low: 512, medium: 1024, high: 2048 },
});
```

## Agent State

```typescript
interface AgentState {
  systemPrompt: string;
  model: Model<any>;
  thinkingLevel: ThinkingLevel;
  tools: AgentTool<any>[];
  messages: AgentMessage[];
  isStreaming: boolean;
  streamMessage: AgentMessage | null;  // Partial during streaming
  pendingToolCalls: Set<string>;
  error?: string;
}
```

Access via `agent.state`. During streaming, `streamMessage` holds the partial assistant message.

## Methods

### Prompting

```typescript
await agent.prompt("Hello");                           // Text
await agent.prompt("Describe this", [imageAttachment]); // With images
await agent.prompt(agentMessage);                       // Direct AgentMessage
await agent.continue();                                 // Resume (last msg must be user or toolResult)
```

### State Management

```typescript
agent.setSystemPrompt("New prompt");
agent.setModel(getModel("openai", "gpt-4o"));
agent.setThinkingLevel("medium");
agent.setTools([myTool]);
agent.replaceMessages(newMessages);
agent.appendMessage(message);
agent.clearMessages();
agent.reset();
```

### Control

```typescript
agent.abort();
await agent.waitForIdle();
```

### Events

```typescript
const unsubscribe = agent.subscribe((event) => console.log(event.type));
unsubscribe();
```

## Event Flow

### Basic prompt

```
prompt("Hello")
├─ agent_start
├─ turn_start
├─ message_start   { userMessage }
├─ message_end     { userMessage }
├─ message_start   { assistantMessage }
├─ message_update  { streaming chunks... }
├─ message_end     { assistantMessage }
├─ turn_end        { message, toolResults: [] }
└─ agent_end       { messages: [...] }
```

### With tool calls

```
prompt("Read config.json")
├─ agent_start
├─ turn_start
├─ message_start/end  { userMessage }
├─ message_start/end  { assistantMessage with toolCall }
├─ tool_execution_start  { toolCallId, toolName, args }
├─ tool_execution_update { partialResult }
├─ tool_execution_end    { toolCallId, result }
├─ message_start/end  { toolResultMessage }
├─ turn_end           { message, toolResults: [...] }
├─ turn_start         // Next turn: LLM responds to tool result
├─ message_start/end  { assistantMessage }
├─ turn_end
└─ agent_end
```

## Event Types

| Event | Description |
| --- | --- |
| `agent_start` | Agent begins processing |
| `agent_end` | Agent completes with all new messages |
| `turn_start` | New turn begins (one LLM call + tool executions) |
| `turn_end` | Turn completes with assistant message and tool results |
| `message_start` | Any message begins |
| `message_update` | **Assistant only.** Contains `assistantMessageEvent` with delta |
| `message_end` | Message completes |
| `tool_execution_start` | Tool begins |
| `tool_execution_update` | Tool streams progress |
| `tool_execution_end` | Tool completes |

## AgentMessage and Custom Types

`AgentMessage` extends LLM messages with custom types via declaration merging:

```typescript
declare module "@mariozechner/pi-agent-core" {
  interface CustomAgentMessages {
    notification: { role: "notification"; text: string; timestamp: number };
  }
}

const msg: AgentMessage = { role: "notification", text: "Info", timestamp: Date.now() };
```

Handle custom types in `convertToLlm`:

```typescript
convertToLlm: (messages) => messages.flatMap(m => {
  if (m.role === "notification") return []; // Filter out
  return [m];
}),
```

### Message Flow

```
AgentMessage[] → transformContext() → AgentMessage[] → convertToLlm() → Message[] → LLM
```

## Tools

```typescript
import { Type } from "@sinclair/typebox";

const tool: AgentTool = {
  name: "read_file",
  label: "Read File",
  description: "Read a file's contents",
  parameters: Type.Object({
    path: Type.String({ description: "File path" }),
  }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    // Stream progress
    onUpdate?.({ content: [{ type: "text", text: "Reading..." }], details: {} });

    const content = await fs.readFile(params.path, "utf-8");
    return {
      content: [{ type: "text", text: content }],
      details: { path: params.path, size: content.length },
    };
  },
};
```

**Error handling:** Throw errors on failure — don't return error messages as content. The agent catches them and reports to the LLM with `isError: true`.

## Steering and Follow-ups

Steering interrupts the agent mid-tool-execution. Follow-ups queue work after the current run.

```typescript
// While agent is running
agent.steer({ role: "user", content: "Stop! Do this instead.", timestamp: Date.now() });

// After agent finishes
agent.followUp({ role: "user", content: "Also summarize.", timestamp: Date.now() });

// Queue management
agent.clearSteeringQueue();
agent.clearFollowUpQueue();
agent.clearAllQueues();

// Mode control
agent.setSteeringMode("one-at-a-time"); // or "all"
agent.setFollowUpMode("one-at-a-time"); // or "all"
```

When steering is detected after a tool completes: remaining tools are skipped with error results, steering messages are injected, and the LLM responds to the interruption.

## Proxy Usage

For browser apps proxying through a backend:

```typescript
import { Agent, streamProxy } from "@mariozechner/pi-agent-core";

const agent = new Agent({
  streamFn: (model, context, options) =>
    streamProxy(model, context, {
      ...options,
      authToken: "...",
      proxyUrl: "https://your-server.com",
    }),
});
```

## Low-Level API

For direct control without the Agent class:

```typescript
import { agentLoop, agentLoopContinue } from "@mariozechner/pi-agent-core";

const context: AgentContext = {
  systemPrompt: "You are helpful.",
  messages: [],
  tools: [],
};

const config: AgentLoopConfig = {
  model: getModel("openai", "gpt-4o"),
  convertToLlm: (msgs) => msgs.filter(m => ["user", "assistant", "toolResult"].includes(m.role)),
};

for await (const event of agentLoop([userMessage], context, config)) {
  console.log(event.type);
}

// Continue from existing context
for await (const event of agentLoopContinue(context, config)) {
  console.log(event.type);
}
```
