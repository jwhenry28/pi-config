export interface PluginUI {
  notify: (msg: string, level: string) => void;
  confirm: (title: string, msg: string) => Promise<boolean>;
  setStatus: (id: string, text: string | undefined) => void;
  custom: <T>(factory: (tui: any, theme: any, keybindings: any, done: (result: T) => void) => any) => Promise<T>;
}

export interface PluginExecutionContext {
  cwd: string;
  ui: PluginUI;
  reload?: () => Promise<void>;
}

/** Theme subset used by module display formatting. */
export interface ThemeFg {
  fg: (token: string, text: string) => string;
  bold: (text: string) => string;
}

/** UI available to module commands (extends PluginUI with theme access). */
export interface ModuleUI extends PluginUI {
  theme: ThemeFg;
}

/** Context passed to module command handlers. */
export interface ModuleCommandContext {
  cwd: string;
  ui: ModuleUI;
}
