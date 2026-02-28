# Output Truncation

Tools **MUST** truncate output to avoid context overflow. Built-in limit: 50KB / 2000 lines.

## Pattern

```typescript
import {
  truncateHead,
  truncateTail,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
} from "@mariozechner/pi-coding-agent";

const truncation = truncateHead(output, {
  maxLines: DEFAULT_MAX_LINES,
  maxBytes: DEFAULT_MAX_BYTES,
});

// Returns: { content, truncated, totalLines, outputLines, totalBytes, outputBytes }
let resultText = truncation.content;
if (truncation.truncated) {
  resultText += `\n[Truncated: ${truncation.outputLines}/${truncation.totalLines} lines, ${formatSize(truncation.outputBytes)}/${formatSize(truncation.totalBytes)}]`;
}

return {
  content: [{ type: "text", text: resultText }],
};
```

## Functions

- **`truncateHead(output, opts)`** - Keep the last N lines/bytes (most recent output)
- **`truncateTail(output, opts)`** - Keep the first N lines/bytes (start of output)

Choose based on what's important for the LLM:
- Error logs: use `truncateHead` (errors at end)
- Build output: use `truncateTail` (compilation starts at top)
- File listings: use `truncateHead` (recent files matter)
