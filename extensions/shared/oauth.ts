/**
 * Central OAuth credential management for pi extensions.
 *
 * Stores credentials under ~/.pi/oauth/{serviceName}-credentials.json
 * and client registrations under ~/.pi/oauth/{serviceName}-client.json.
 *
 * Supports OAuth 2.1 + PKCE with dynamic client registration (RFC 7591).
 */

import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { exec } from "node:child_process";
import { getHomeDir } from "./home.js";

// =============================================================================
// Types
// =============================================================================

export interface OAuthServiceConfig {
  /** Short identifier, e.g. "linear". Used for file naming. */
  serviceName: string;
  /** .well-known/oauth-authorization-server URL */
  metadataUrl: string;
  /** Port for the localhost callback server */
  callbackPort: number;
  /** Client name for dynamic registration */
  clientName: string;
  /** Timeout for the OAuth flow in ms (default 120_000) */
  timeoutMs?: number;
}

export interface OAuthMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  revocation_endpoint?: string;
  code_challenge_methods_supported?: string[];
}

export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
}

interface ClientRegistration {
  clientId: string;
  registeredAt: number;
}

/** Callback interface for UI notifications during the OAuth flow. */
export interface OAuthUI {
  notify(message: string, level: "info" | "error"): void;
}

// =============================================================================
// Paths
// =============================================================================

function oauthDir(): string {
  return join(getHomeDir(), ".pi", "oauth");
}

function credentialsPath(serviceName: string): string {
  return join(oauthDir(), `${serviceName}-credentials.json`);
}

function clientRegPath(serviceName: string): string {
  return join(oauthDir(), `${serviceName}-client.json`);
}

// =============================================================================
// Credential Storage
// =============================================================================

export function loadCredentials(serviceName: string): OAuthCredentials | null {
  try {
    return JSON.parse(readFileSync(credentialsPath(serviceName), "utf-8"));
  } catch {
    return null;
  }
}

export function saveCredentials(serviceName: string, creds: OAuthCredentials): void {
  const dir = oauthDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(credentialsPath(serviceName), JSON.stringify(creds, null, 2), { mode: 0o600 });
}

export function clearCredentials(serviceName: string): void {
  try {
    unlinkSync(credentialsPath(serviceName));
  } catch {
    /* ignore */
  }
}

// =============================================================================
// Client Registration Storage
// =============================================================================

function loadClientRegistration(serviceName: string): ClientRegistration | null {
  try {
    return JSON.parse(readFileSync(clientRegPath(serviceName), "utf-8"));
  } catch {
    return null;
  }
}

function saveClientRegistration(serviceName: string, reg: ClientRegistration): void {
  const dir = oauthDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(clientRegPath(serviceName), JSON.stringify(reg, null, 2), { mode: 0o600 });
}

// =============================================================================
// OAuth Metadata Discovery
// =============================================================================

const metadataCache = new Map<string, OAuthMetadata>();

export async function getOAuthMetadata(metadataUrl: string): Promise<OAuthMetadata> {
  const cached = metadataCache.get(metadataUrl);
  if (cached) return cached;

  const res = await fetch(metadataUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch OAuth metadata: ${res.status} ${await res.text()}`);
  }
  const metadata = (await res.json()) as OAuthMetadata;
  metadataCache.set(metadataUrl, metadata);
  return metadata;
}

// =============================================================================
// PKCE Helpers
// =============================================================================

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// =============================================================================
// Dynamic Client Registration (RFC 7591)
// =============================================================================

export async function ensureClientRegistration(config: OAuthServiceConfig): Promise<string> {
  const existing = loadClientRegistration(config.serviceName);
  if (existing) return existing.clientId;

  const redirectUri = `http://localhost:${config.callbackPort}/callback`;
  const metadata = await getOAuthMetadata(config.metadataUrl);
  const response = await fetch(metadata.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: config.clientName,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Dynamic client registration failed: ${response.status} ${errText}`);
  }

  const data = (await response.json()) as { client_id: string };
  const reg: ClientRegistration = { clientId: data.client_id, registeredAt: Date.now() };
  saveClientRegistration(config.serviceName, reg);
  return reg.clientId;
}

// =============================================================================
// Token Refresh
// =============================================================================

export async function refreshAccessToken(
  config: OAuthServiceConfig,
  refreshToken: string,
): Promise<OAuthCredentials | null> {
  const clientId = loadClientRegistration(config.serviceName)?.clientId;
  if (!clientId) return null;

  try {
    const metadata = await getOAuthMetadata(config.metadataUrl);
    const response = await fetch(metadata.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { access_token: string; refresh_token?: string };
    const creds: OAuthCredentials = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
    };
    saveCredentials(config.serviceName, creds);
    return creds;
  } catch {
    return null;
  }
}

// =============================================================================
// OAuth 2.1 + PKCE Flow
// =============================================================================

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${cmd} "${url}"`);
}

/**
 * Perform a full OAuth 2.1 + PKCE authorization code flow.
 * Opens a browser, waits for the callback, exchanges the code for tokens.
 */
export async function performOAuthFlow(
  config: OAuthServiceConfig,
  ui: OAuthUI,
): Promise<OAuthCredentials> {
  const metadata = await getOAuthMetadata(config.metadataUrl);
  const clientId = await ensureClientRegistration(config);
  const redirectUri = `http://localhost:${config.callbackPort}/callback`;
  const state = randomUUID();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const timeoutMs = config.timeoutMs ?? 120_000;

  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return new Promise<OAuthCredentials>((resolve, reject) => {
    let server: Server | null = null;
    const timeout = setTimeout(() => {
      server?.close();
      reject(
        new Error(
          `OAuth flow timed out after ${timeoutMs / 1000} seconds. The callback at ${redirectUri} was never reached.`,
        ),
      );
    }, timeoutMs);

    server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", `http://localhost:${config.callbackPort}`);
        if (url.pathname !== "/callback") {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        ui.notify("OAuth callback received, exchanging code for token...", "info");

        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h2>Authorization failed</h2><p>You can close this tab.</p></body></html>",
          );
          clearTimeout(timeout);
          server?.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (!code || returnedState !== state) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h2>Invalid callback</h2><p>State mismatch or missing code.</p></body></html>",
          );
          clearTimeout(timeout);
          server?.close();
          reject(
            new Error(`OAuth callback invalid: ${!code ? "missing code" : "state mismatch"}`),
          );
          return;
        }

        // Exchange code for token
        const tokenResponse = await fetch(metadata.token_endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
          }).toString(),
        });

        const responseText = await tokenResponse.text();
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(responseText);
        } catch {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h2>Token exchange failed</h2><p>Non-JSON response. You can close this tab.</p></body></html>",
          );
          clearTimeout(timeout);
          server?.close();
          reject(
            new Error(
              `Token exchange: non-JSON response (${tokenResponse.status}): ${responseText.slice(0, 200)}`,
            ),
          );
          return;
        }

        if (!tokenResponse.ok || data.error) {
          const errDetail = data.error_description ?? data.error ?? responseText.slice(0, 200);
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            `<html><body><h2>Token exchange failed</h2><p>${errDetail}</p></body></html>`,
          );
          clearTimeout(timeout);
          server?.close();
          reject(new Error(`Token exchange failed (${tokenResponse.status}): ${errDetail}`));
          return;
        }

        if (!data.access_token) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h2>Token exchange failed</h2><p>No access_token.</p></body></html>",
          );
          clearTimeout(timeout);
          server?.close();
          reject(
            new Error(
              `Token exchange: no access_token. Keys: ${Object.keys(data).join(", ")}`,
            ),
          );
          return;
        }

        const creds: OAuthCredentials = {
          accessToken: data.access_token as string,
          refreshToken: data.refresh_token as string | undefined,
        };
        saveCredentials(config.serviceName, creds);

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          `<html><body><h2>&#x2714; ${config.serviceName.charAt(0).toUpperCase() + config.serviceName.slice(1)} authorized</h2><p>You can close this tab and return to pi.</p></body></html>`,
        );
        clearTimeout(timeout);
        server?.close();
        resolve(creds);
      } catch (err) {
        clearTimeout(timeout);
        server?.close();
        reject(err);
      }
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${config.callbackPort} already in use. Close the process using it and retry.`,
          ),
        );
      } else {
        reject(err);
      }
    });

    server.listen(config.callbackPort, () => {
      const authUrl = `${metadata.authorization_endpoint}?${authParams.toString()}`;
      openBrowser(authUrl);
      ui.notify("Opening browser for authorization...", "info");
    });
  });
}
