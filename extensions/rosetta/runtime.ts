import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ExecutePythonToolOptions {
  throwOnJsonError?: boolean;
}

export async function executePythonTool(
  entrypoint: string,
  input: unknown,
  argv: string[] = [],
  options: ExecutePythonToolOptions = {},
): Promise<string> {
  const jsonArg = JSON.stringify(input ?? {});
  const { stdout, stderr } = await runPythonTool(entrypoint, argv, jsonArg);

  return parsePythonToolOutput(stdout, stderr, options);
}

async function runPythonTool(entrypoint: string, argv: string[], jsonArg: string): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync("python3", [entrypoint, ...argv, jsonArg]);
  } catch (error) {
    throw new Error(formatPythonExecutionError(error));
  }
}

function formatPythonExecutionError(error: unknown): string {
  const err = error as Error & { code?: number | string; signal?: string; stderr?: string; stdout?: string };
  const exitCode = err.code ?? "unknown";
  const details = [
    formatErrorDetail("message", err.message),
    formatErrorDetail("signal", err.signal),
    formatErrorDetail("stderr", err.stderr),
    formatErrorDetail("stdout", err.stdout),
  ].filter((detail) => detail.length > 0);

  return [`Rosetta Python tool failed with exit code ${exitCode}.`, ...details].join(" ");
}

function formatErrorDetail(label: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "";
  }

  return `${label}: ${value.trim()}`;
}

export function parsePythonToolOutput(
  stdout: string,
  stderr?: string,
  options: ExecutePythonToolOptions = {},
): string {
  const trimmed = stdout.trim();
  if (!trimmed) {
    const hasStderr = typeof stderr === "string" && stderr.trim().length > 0;
    const stderrText = hasStderr ? ` stderr: ${stderr.trim()}` : "";
    throw new Error(`Rosetta Python tool returned empty stdout.${stderrText}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const hasStderr = typeof stderr === "string" && stderr.trim().length > 0;
    const stderrText = hasStderr ? ` stderr: ${stderr.trim()}` : "";
    throw new Error(`Rosetta Python tool returned invalid JSON.${stderrText}`);
  }

  const hasError = typeof parsed?.error === "string" && parsed.error.length > 0;
  if (hasError) {
    if (options.throwOnJsonError === false) {
      return JSON.stringify({ error: parsed.error });
    }

    throw new Error(`Rosetta Python tool error: ${parsed.error}`);
  }

  const hasResult = typeof parsed === "object" && parsed !== null && "result" in parsed;
  if (!hasResult) {
    throw new Error('Rosetta Python tool output must contain either "result" or "error"');
  }

  return typeof parsed.result === "string" ? parsed.result : JSON.stringify(parsed.result);
}
