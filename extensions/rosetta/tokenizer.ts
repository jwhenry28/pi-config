import { parse } from "shell-quote";

export function tokenizeCommandInput(input: string): string[] | Error {
  try {
    return parseShellTokens(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`Malformed command syntax: ${message}`);
  }
}

function parseShellTokens(input: string): string[] | Error {
  const parsedTokens = parse(input);
  const tokens: string[] = [];

  for (const parsedToken of parsedTokens) {
    if (typeof parsedToken !== "string") {
      return new Error("Unsupported shell syntax in command arguments");
    }

    tokens.push(parsedToken);
  }

  return tokens;
}
