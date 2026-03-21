/**
 * Shared output truncation utility for extension tool results.
 */

import {
  truncateTail,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
} from "@mariozechner/pi-coding-agent";

/**
 * Truncate tool output to fit within pi's limits (50KB / 2000 lines).
 * Appends a truncation notice when output is trimmed.
 */
export function truncateOutput(output: string): string {
  const truncation = truncateTail(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });
  let text = truncation.content;
  if (truncation.truncated) {
    text += `\n\n[Output truncated: showed ${truncation.outputLines} of ${truncation.totalLines} lines]`;
  }
  return text;
}
