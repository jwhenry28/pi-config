/**
 * Generic MCP Streamable HTTP client.
 *
 * Handles JSON-RPC over HTTP with SSE response parsing,
 * session management, and automatic token refresh on auth failures.
 */

import type { OAuthCredentials, OAuthServiceConfig } from "./oauth.js";
import { refreshAccessToken, clearCredentials } from "./oauth.js";

// =============================================================================
// Types
// =============================================================================

export interface McpSession {
  sessionId: string | null;
  accessToken: string;
  mcpUrl: string;
}

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export class McpAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpAuthError";
  }
}

// =============================================================================
// JSON-RPC
// =============================================================================

let nextJsonRpcId = 1;

/**
 * Send a JSON-RPC request to an MCP endpoint.
 * Handles both plain JSON and SSE response formats.
 */
export async function mcpRequest(
  session: McpSession,
  method: string,
  params?: Record<string, unknown>,
): Promise<any> {
  const id = nextJsonRpcId++;
  const body: Record<string, unknown> = { jsonrpc: "2.0", method, id };
  if (params !== undefined) body.params = params;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${session.accessToken}`,
  };
  if (session.sessionId) {
    headers["Mcp-Session-Id"] = session.sessionId;
  }

  const response = await fetch(session.mcpUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  // Capture session ID
  const newSessionId = response.headers.get("mcp-session-id");
  if (newSessionId) session.sessionId = newSessionId;

  if (response.status === 401) {
    throw new McpAuthError("MCP authentication failed (401)");
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`MCP request failed (${response.status}): ${errText.slice(0, 500)}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("text/event-stream")) {
    return parseSSEResponse(response, id);
  }

  // Plain JSON
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`MCP returned empty response for method "${method}"`);
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`MCP returned non-JSON (${contentType}): ${text.slice(0, 300)}`);
  }

  if (json.error) {
    throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
  }
  return json.result;
}

/**
 * Send a JSON-RPC notification (no id, no response expected).
 */
export async function mcpNotify(
  session: McpSession,
  method: string,
  params?: Record<string, unknown>,
): Promise<void> {
  const body: Record<string, unknown> = { jsonrpc: "2.0", method };
  if (params !== undefined) body.params = params;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.accessToken}`,
  };
  if (session.sessionId) {
    headers["Mcp-Session-Id"] = session.sessionId;
  }

  await fetch(session.mcpUrl, { method: "POST", headers, body: JSON.stringify(body) });
}

/**
 * Parse an SSE response to extract the JSON-RPC result matching a request ID.
 */
export async function parseSSEResponse(
  response: Response,
  expectedId: number,
): Promise<any> {
  const raw = await response.text();
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const events = text.split("\n\n").filter(Boolean);

  for (const event of events) {
    for (const line of event.split("\n")) {
      let jsonStr: string | null = null;
      if (line.startsWith("data: ")) jsonStr = line.slice(6);
      else if (line.startsWith("data:")) jsonStr = line.slice(5);
      if (!jsonStr) continue;

      try {
        const msg = JSON.parse(jsonStr);
        if (Array.isArray(msg)) {
          const match = msg.find((m: any) => m.id === expectedId);
          if (match) {
            if (match.error)
              throw new Error(`MCP error ${match.error.code}: ${match.error.message}`);
            return match.result;
          }
        } else if (msg.id === expectedId) {
          if (msg.error) throw new Error(`MCP error ${msg.error.code}: ${msg.error.message}`);
          return msg.result;
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("MCP error")) throw e;
      }
    }
  }

  throw new Error(
    `No matching JSON-RPC response in SSE stream (id=${expectedId}, ` +
      `raw_length=${raw.length}, events=${events.length})`,
  );
}

// =============================================================================
// Session Management
// =============================================================================

export interface McpClientConfig {
  mcpUrl: string;
  clientName: string;
  clientVersion: string;
}

export async function createMcpSession(
  config: McpClientConfig,
  accessToken: string,
): Promise<McpSession> {
  const session: McpSession = {
    sessionId: null,
    accessToken,
    mcpUrl: config.mcpUrl,
  };

  await mcpRequest(session, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: config.clientName, version: config.clientVersion },
  });

  await mcpNotify(session, "notifications/initialized");
  return session;
}

/**
 * Get or create an MCP session, handling token refresh on auth failure.
 */
export async function getOrCreateSession(
  config: McpClientConfig,
  oauthConfig: OAuthServiceConfig,
  creds: OAuthCredentials,
  currentSession: McpSession | null,
): Promise<McpSession> {
  if (currentSession && currentSession.accessToken === creds.accessToken) {
    return currentSession;
  }

  try {
    return await createMcpSession(config, creds.accessToken);
  } catch (err) {
    if (err instanceof McpAuthError && creds.refreshToken) {
      const refreshed = await refreshAccessToken(oauthConfig, creds.refreshToken);
      if (refreshed) {
        try {
          return await createMcpSession(config, refreshed.accessToken);
        } catch {
          /* fall through */
        }
      }
    }
    clearCredentials(oauthConfig.serviceName);
    throw new Error(
      `${oauthConfig.serviceName} token expired or revoked. Run /linear-login to re-authenticate.`,
    );
  }
}

// =============================================================================
// Tool Calls
// =============================================================================

export async function mcpToolCall(
  session: McpSession,
  toolName: string,
  args: Record<string, unknown>,
): Promise<any> {
  try {
    return await mcpRequest(session, "tools/call", { name: toolName, arguments: args });
  } catch (err) {
    if (err instanceof McpAuthError) throw err;
    throw err;
  }
}

export async function mcpToolsList(session: McpSession): Promise<McpToolDef[]> {
  const result = await mcpRequest(session, "tools/list", {});
  return result?.tools ?? [];
}

/**
 * Extract text content from an MCP tool result.
 */
export function extractMcpText(result: any): string {
  if (!result?.content) return JSON.stringify(result, null, 2) ?? "No result";
  return result.content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text ?? "")
    .join("\n");
}
