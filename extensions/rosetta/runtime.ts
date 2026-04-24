import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function executePythonTool(entrypoint: string, input: unknown, argv: string[] = []): Promise<string> {
  const jsonArg = JSON.stringify(input ?? {});

  try {
    const { stdout, stderr } = await execFileAsync("python3", [entrypoint, ...argv, jsonArg]);
    return parsePythonToolOutput(stdout, stderr);
  } catch (error) {
    const err = error as Error & { code?: number | string; stderr?: string };
    const exitCode = err.code ?? "unknown";
    const hasStderr = typeof err.stderr === "string" && err.stderr.trim().length > 0;
    const stderrText = hasStderr ? ` stderr: ${err.stderr?.trim()}` : "";
    throw new Error(`Rosetta Python tool failed with exit code ${exitCode}.${stderrText}`);
  }
}

export function parsePythonToolOutput(stdout: string, stderr?: string): string {
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
    throw new Error(`Rosetta Python tool error: ${parsed.error}`);
  }

  const hasResult = typeof parsed === "object" && parsed !== null && "result" in parsed;
  if (!hasResult) {
    throw new Error('Rosetta Python tool output must contain either "result" or "error"');
  }

  return typeof parsed.result === "string" ? parsed.result : JSON.stringify(parsed.result);
}
