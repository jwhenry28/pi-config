export interface ConfigModelRegistry {
  getAll(): Array<{ id: string }>;
  find?: (provider: string, id: string) => unknown;
}

export interface ConfigUI {
  notify: (msg: string, level: string) => void;
}

export interface ConfigExecutionContext {
  cwd: string;
  storeName: string;
  ui: ConfigUI;
  modelRegistry: ConfigModelRegistry;
}

export interface ConfigEntry {
  name: string;
  description: string;
  default?: string;
  validator?: (value: string, ctx: ConfigExecutionContext) => void;
}

export interface ConfigFileEntry {
  name: string;
  value: string;
}

export interface ConfigFile {
  name: string;
  description?: string;
  configs?: ConfigFileEntry[];
}

export interface ApplyResult {
  updatedKeys: string[];
  warnings: string[];
}
