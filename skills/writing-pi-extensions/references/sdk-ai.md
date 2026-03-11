# @mariozechner/pi-ai SDK Reference

Unified LLM API with model discovery, streaming, tool definitions, and cost tracking.

## Table of Contents

- [Quick Start](#quick-start)
- [Models and Providers](#models-and-providers)
- [Context and Messages](#context-and-messages)
- [Streaming and Completion](#streaming-and-completion)
- [Tools](#tools)
- [Thinking/Reasoning](#thinkingreasoning)
- [Streaming Events](#streaming-events)
- [Cross-Provider Handoffs](#cross-provider-handoffs)
- [Image Input](#image-input)
- [Error Handling](#error-handling)
- [OAuth Providers](#oauth-providers)
- [Environment Variables](#environment-variables)

## Quick Start

```typescript
import { Type, getModel, stream, complete, Context, Tool, StringEnum } from '@mariozechner/pi-ai';

const model = getModel('openai', 'gpt-4o-mini');

const context: Context = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'Hello' }],
  tools: []
};

// Streaming
const s = stream(model, context);
for await (const event of s) {
  if (event.type === 'text_delta') process.stdout.write(event.delta);
}
const finalMessage = await s.result();

// Non-streaming
const response = await complete(model, context);
```

## Models and Providers

Supported providers: OpenAI, Anthropic, Google, Vertex AI, Mistral, Groq, Cerebras, xAI, OpenRouter, Vercel AI Gateway, MiniMax, GitHub Copilot, Google Gemini CLI, Antigravity, Amazon Bedrock, Azure OpenAI, OpenAI Codex, Kimi For Coding, and any OpenAI-compatible API (Ollama, vLLM, LM Studio, etc.).

```typescript
import { getProviders, getModels, getModel } from '@mariozechner/pi-ai';

const providers = getProviders();        // ['openai', 'anthropic', 'google', ...]
const models = getModels('anthropic');   // All models from provider
const model = getModel('openai', 'gpt-4o-mini'); // Specific model (auto-completed)

// Model properties
model.id            // Model ID
model.name          // Display name
model.api           // API implementation used
model.provider      // Provider name
model.contextWindow // Context window in tokens
model.reasoning     // Whether model supports thinking
model.input         // ['text'] or ['text', 'image']
model.cost          // { input, output, cacheRead, cacheWrite } per million tokens
```

### Custom Models

```typescript
const ollamaModel: Model<'openai-completions'> = {
  id: 'llama-3.1-8b',
  name: 'Llama 3.1 8B (Ollama)',
  api: 'openai-completions',
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  reasoning: false,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 32000
};
```

### OpenAI Compatibility Settings

For custom OpenAI-compatible endpoints, use the `compat` field:

```typescript
const model: Model<'openai-completions'> = {
  // ...
  compat: {
    supportsStore?: boolean,
    supportsDeveloperRole?: boolean,
    supportsReasoningEffort?: boolean,
    supportsUsageInStreaming?: boolean,
    supportsStrictMode?: boolean,
    maxTokensField?: 'max_completion_tokens' | 'max_tokens',
    requiresToolResultName?: boolean,
    requiresAssistantAfterToolResult?: boolean,
    thinkingFormat?: 'openai' | 'zai' | 'qwen',
  }
};
```

## Context and Messages

```typescript
interface Context {
  systemPrompt?: string;
  messages: Message[];  // user | assistant | toolResult
  tools?: Tool[];
}

// User message
{ role: 'user', content: 'Hello' }
{ role: 'user', content: [
  { type: 'text', text: 'Describe this' },
  { type: 'image', data: base64, mimeType: 'image/png' }
]}

// Assistant message (returned from LLM)
{ role: 'assistant', content: [
  { type: 'text', text: '...' },
  { type: 'thinking', thinking: '...' },
  { type: 'toolCall', id: '...', name: '...', arguments: {...} }
], stopReason: 'stop' | 'length' | 'toolUse' | 'error' | 'aborted', usage: {...} }

// Tool result
{ role: 'toolResult', toolCallId: '...', toolName: '...', 
  content: [{ type: 'text', text: '...' }], isError: false, timestamp: Date.now() }
```

### Context Serialization

Context is plain JSON — serialize with `JSON.stringify()`, restore with `JSON.parse()`.

## Streaming and Completion

```typescript
// stream() — returns async iterable + result() promise
const s = stream(model, context, options?);
for await (const event of s) { /* handle events */ }
const message = await s.result();

// complete() — returns final message directly
const message = await complete(model, context, options?);

// Simple variants with unified reasoning option
const s = streamSimple(model, context, { reasoning: 'medium' });
const msg = await completeSimple(model, context, { reasoning: 'high' });
```

### Options

```typescript
{
  apiKey?: string,          // Override env variable
  signal?: AbortSignal,     // Cancellation
  sessionId?: string,       // Provider caching
  onPayload?: (payload) => void,  // Debug provider requests
}
```

## Tools

```typescript
import { Type, StringEnum, Tool } from '@mariozechner/pi-ai';

const tool: Tool = {
  name: 'get_weather',
  description: 'Get weather for a location',
  parameters: Type.Object({
    location: Type.String({ description: 'City name' }),
    units: StringEnum(['celsius', 'fahrenheit'], { default: 'celsius' })
  })
};
```

**Important:** Use `StringEnum` from `@mariozechner/pi-ai` for string enums — `Type.Union`/`Type.Literal` doesn't work with Google's API.

### Validating Tool Arguments

```typescript
import { validateToolCall } from '@mariozechner/pi-ai';

// Throws on invalid args
const validatedArgs = validateToolCall(tools, toolCall);
```

## Thinking/Reasoning

```typescript
// Unified (recommended)
const response = await completeSimple(model, context, {
  reasoning: 'medium'  // 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
});

// Provider-specific
// Anthropic
await complete(model, context, { thinkingEnabled: true, thinkingBudgetTokens: 8192 });
// OpenAI
await complete(model, context, { reasoningEffort: 'medium' });
// Google
await complete(model, context, { thinking: { enabled: true, budgetTokens: 8192 } });
```

Check `model.reasoning` to see if a model supports thinking.

## Streaming Events

| Event | Description | Key Properties |
| --- | --- | --- |
| `start` | Stream begins | `partial` |
| `text_start` | Text block starts | `contentIndex` |
| `text_delta` | Text chunk | `delta`, `contentIndex` |
| `text_end` | Text block complete | `content`, `contentIndex` |
| `thinking_start` | Thinking starts | `contentIndex` |
| `thinking_delta` | Thinking chunk | `delta`, `contentIndex` |
| `thinking_end` | Thinking complete | `content`, `contentIndex` |
| `toolcall_start` | Tool call begins | `contentIndex` |
| `toolcall_delta` | Tool args streaming | `delta`, partial parsed args |
| `toolcall_end` | Tool call complete | `toolCall` with `id`, `name`, `arguments` |
| `done` | Stream complete | `reason`, `message` |
| `error` | Error occurred | `reason` ("error"/"aborted"), `error` |

## Cross-Provider Handoffs

Messages from one provider work with another. Thinking blocks from foreign providers are auto-converted to `<thinking>` tagged text.

```typescript
const claude = getModel('anthropic', 'claude-sonnet-4-20250514');
const gpt = getModel('openai', 'gpt-4o');

// Build context with Claude, then switch to GPT
const response1 = await complete(claude, context);
context.messages.push(response1);
context.messages.push({ role: 'user', content: 'Continue' });
const response2 = await complete(gpt, context); // Works seamlessly
```

## Image Input

```typescript
const response = await complete(model, {
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image', data: base64Data, mimeType: 'image/png' }
    ]
  }]
});
```

Check `model.input.includes('image')` for vision support. Images passed to non-vision models are silently ignored.

## Error Handling

```typescript
// Streaming errors
for await (const event of s) {
  if (event.type === 'error') {
    console.error(event.reason, event.error.errorMessage);
  }
}

// Abort
const controller = new AbortController();
const s = stream(model, context, { signal: controller.signal });
controller.abort();
const partial = await s.result(); // partial.stopReason === 'aborted'
```

Stop reasons: `"stop"`, `"length"`, `"toolUse"`, `"error"`, `"aborted"`.

## OAuth Providers

Providers requiring OAuth: Anthropic (Claude Pro/Max), OpenAI Codex, GitHub Copilot, Google Gemini CLI, Antigravity.

```bash
npx @mariozechner/pi-ai login              # Interactive provider selection
npx @mariozechner/pi-ai login anthropic    # Login to specific provider
npx @mariozechner/pi-ai list               # List providers
```

```typescript
import { loginGitHubCopilot, getOAuthApiKey, refreshOAuthToken } from '@mariozechner/pi-ai';

// Login
const credentials = await loginGitHubCopilot({
  onAuth: (url, instructions) => console.log(`Open: ${url}`),
  onPrompt: async (prompt) => getUserInput(prompt.message),
  onProgress: (message) => console.log(message)
});

// Get API key (auto-refreshes if expired)
const result = await getOAuthApiKey('github-copilot', authMap);
await complete(model, context, { apiKey: result.apiKey });
```

## Environment Variables

| Provider | Variable |
| --- | --- |
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` or `ANTHROPIC_OAUTH_TOKEN` |
| Google | `GEMINI_API_KEY` |
| Vertex AI | `GOOGLE_CLOUD_PROJECT` + `GOOGLE_CLOUD_LOCATION` + ADC |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_BASE_URL` or `AZURE_OPENAI_RESOURCE_NAME` |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| xAI | `XAI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| GitHub Copilot | `COPILOT_GITHUB_TOKEN` or `GH_TOKEN` or `GITHUB_TOKEN` |
| Kimi For Coding | `KIMI_API_KEY` |

Check with `getEnvApiKey('openai')`. Set `PI_CACHE_RETENTION=long` for extended prompt cache retention.
