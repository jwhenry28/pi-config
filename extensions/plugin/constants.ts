export interface PluginUI {
  notify: (msg: string, level: string) => void;
  confirm: (title: string, msg: string) => Promise<boolean>;
  custom: <T>(factory: (tui: any, theme: any, keybindings: any, done: (result: T) => void) => any) => Promise<T>;
}

export interface PluginExecutionContext {
  cwd: string;
  ui: PluginUI;
  reload?: () => Promise<void>;
}
