export interface ModuleDisplayItem {
  name: string;
  enabled: boolean;
}

interface ModuleDisplayFormatOptions {
  formatHeader?: (text: string) => string;
  formatEnabledLine?: (name: string) => string;
  formatDisabledLine?: (name: string) => string;
}

export function formatModulesBlock(
  items: ModuleDisplayItem[],
  options: ModuleDisplayFormatOptions = {},
): string {
  const header = options.formatHeader ? options.formatHeader("[Modules]") : "[Modules]";
  const lines = [header];

  for (const item of items) {
    if (item.enabled) {
      const enabled = options.formatEnabledLine ? options.formatEnabledLine(item.name) : `* ${item.name}`;
      lines.push(`    ${enabled}`);
    } else {
      const disabled = options.formatDisabledLine ? options.formatDisabledLine(item.name) : `- ${item.name}`;
      lines.push(`    ${disabled}`);
    }
  }

  return lines.join("\n");
}
