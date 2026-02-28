# Custom Rendering

Extensions can provide custom TUI rendering for tool calls and results:

```typescript
import { Text } from "@mariozechner/pi-tui";

pi.registerTool({
  name: "my_tool",
  // ...
  renderCall(args, theme) {
    return new Text(
      theme.fg("toolTitle", theme.bold("my_tool ")) +
        theme.fg("muted", args.action),
      0,
      0,
    );
  },
  renderResult(result, { expanded, isPartial }, theme) {
    if (isPartial) return new Text(theme.fg("warning", "Working..."), 0, 0);
    return new Text(theme.fg("success", "✓ Done"), 0, 0);
  },
});
```

## Important

- Use `Text` with padding `(0, 0)` — the outer Box handles padding
- `isPartial` indicates streaming/in-progress result
- `expanded` indicates whether result is collapsed in TUI
- Theme provides colors via `theme.fg(colorName, text)` and text styling via `theme.bold()`, `theme.dim()`, etc.
