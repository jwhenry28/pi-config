export interface ParsedDuration {
  ms: number;
  display: string;
}

const DURATION_RE = /^(\d+)(m|h)$/i;

export function parseDuration(input: string): ParsedDuration | null {
  const match = input.match(DURATION_RE);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (value <= 0) return null;

  const ms = unit === "h" ? value * 60 * 60 * 1000 : value * 60 * 1000;

  return { ms, display: input.toLowerCase() };
}
