export interface ModuleDisplayItem {
  name: string;
  shown: boolean;
}

interface ModuleDisplayFormatOptions {
  formatHeader?: (text: string) => string;
  formatShownLine?: (name: string) => string;
  formatHiddenLine?: (name: string) => string;
}

export function formatModulesBlock(
  items: ModuleDisplayItem[],
  options: ModuleDisplayFormatOptions = {},
): string {
  const header = options.formatHeader ? options.formatHeader("[Modules]") : "[Modules]";
  const lines = [header];

  for (const item of items) {
    if (item.shown) {
      const shown = options.formatShownLine ? options.formatShownLine(item.name) : `* ${item.name}`;
      lines.push(`    ${shown}`);
    } else {
      const hidden = options.formatHiddenLine ? options.formatHiddenLine(item.name) : `- ${item.name}`;
      lines.push(`    ${hidden}`);
    }
  }

  return lines.join("\n");
}
