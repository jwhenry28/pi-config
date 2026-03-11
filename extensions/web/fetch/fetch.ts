import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

export interface FetchResult {
  url: string;
  title: string;
  content: string;
  error: string | null;
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const TIMEOUT_MS = 30_000;
const DEFAULT_MAX_LENGTH = 50_000;

export async function webFetch(
  url: string,
  maxLength: number = DEFAULT_MAX_LENGTH,
  signal?: AbortSignal,
): Promise<FetchResult> {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return { url, title: "", content: "", error: "URL must start with http:// or https://" };
  }

  const primaryResult = await tryFetchCandidate(url, maxLength, signal);
  if (!primaryResult.error) return primaryResult;

  const abortedRequest = primaryResult.error === "Request aborted";
  if (abortedRequest) return primaryResult;

  const fallbackCandidates = buildFallbackCandidates(url);
  for (const candidate of fallbackCandidates) {
    const fallbackResult = await tryFetchCandidate(candidate, maxLength, signal);
    if (!fallbackResult.error) return fallbackResult;

    const fallbackAborted = fallbackResult.error === "Request aborted";
    if (fallbackAborted) return fallbackResult;
  }

  return primaryResult;
}

function buildFallbackCandidates(url: string): string[] {
  const candidates: string[] = [];

  if (!url.endsWith(".md")) {
    candidates.push(url.replace(/\/?$/, ".md"));
  }

  try {
    const origin = new URL(url).origin;
    candidates.push(`${origin}/.well-known/llms.txt`);
  } catch {
    return candidates;
  }

  return candidates.slice(0, 2);
}

async function tryFetchCandidate(
  url: string,
  maxLength: number,
  signal?: AbortSignal,
): Promise<FetchResult> {
  try {
    const response = await fetchWithTimeout(url, signal);
    if (!response.ok) {
      return { url, title: "", content: "", error: `HTTP ${response.status}` };
    }

    const contentLength = response.headers.get("content-length");
    const hasOversizedHeader = contentLength && parseInt(contentLength, 10) > MAX_SIZE;
    if (hasOversizedHeader) {
      return { url, title: "", content: "", error: "Response exceeds 5MB size limit" };
    }

    const contentType = normalizeContentType(response.headers.get("content-type"));
    const body = await response.text();

    if (body.length > MAX_SIZE) {
      return { url, title: "", content: "", error: "Response exceeds 5MB size limit" };
    }

    const parsed = parseResponseBodyByType(contentType, body, url, maxLength);
    return { url, title: parsed.title, content: parsed.content, error: null };
  } catch (err) {
    const abortError = isAbortError(err) || signal?.aborted;
    if (abortError) {
      return { url, title: "", content: "", error: "Request aborted" };
    }

    return { url, title: "", content: "", error: err instanceof Error ? err.message : String(err) };
  }
}

function parseResponseBodyByType(contentType: string, body: string, sourceUrl: string, maxLength: number) {
  const jsonType = contentType === "application/json" || contentType === "text/json";
  if (jsonType) {
    return { title: "", content: truncate(formatJson(body), maxLength) };
  }

  const markdownLike =
    contentType === "text/plain" ||
    contentType === "text/markdown" ||
    contentType === "text/x-markdown" ||
    contentType === "text/xml" ||
    contentType === "application/xml";
  if (markdownLike) {
    return { title: "", content: truncate(body, maxLength) };
  }

  const htmlLike = contentType.startsWith("text/") || contentType === "application/xhtml+xml";
  if (!htmlLike) {
    throw new Error(`Cannot extract content from ${contentType} (only HTML, JSON, and plain text are supported)`);
  }

  const dom = new JSDOM(body, { url: sourceUrl });
  const article = new Readability(dom.window.document).parse();

  const title = article?.title ?? dom.window.document.title ?? "";
  const turndown = new TurndownService();
  const markdown = turndown.turndown(article?.content ?? body);
  return { title, content: truncate(markdown, maxLength) };
}

function normalizeContentType(contentType: string | null): string {
  return (contentType ?? "text/html").split(";")[0]!.trim();
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

async function fetchWithTimeout(url: string, signal?: AbortSignal): Promise<Response> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), TIMEOUT_MS);

  const mergedSignal = combineSignals(timeoutController.signal, signal);

  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: mergedSignal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function combineSignals(timeoutSignal: AbortSignal, externalSignal?: AbortSignal): AbortSignal {
  if (!externalSignal) return timeoutSignal;

  if (externalSignal.aborted) {
    const controller = new AbortController();
    controller.abort();
    return controller.signal;
  }

  const mergedController = new AbortController();
  const abortMerged = () => mergedController.abort();

  timeoutSignal.addEventListener("abort", abortMerged, { once: true });
  externalSignal.addEventListener("abort", abortMerged, { once: true });

  return mergedController.signal;
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (!(err instanceof Error)) return false;

  const abortMessage = err.message.toLowerCase().includes("abort");
  return abortMessage;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastBreak = truncated.lastIndexOf("\n\n");
  return lastBreak > maxLength * 0.5 ? truncated.slice(0, lastBreak) : truncated;
}
