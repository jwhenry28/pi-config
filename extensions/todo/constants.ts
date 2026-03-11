export const TODO_STORE = "open-todos";
export const NAME_RE = /^[a-zA-Z0-9_-]+$/;

export interface TodoUI {
  notify: (msg: string, level: string) => void;
  confirm: (title: string, msg: string) => Promise<boolean>;
}

export interface TodoExecutionContext {
  cwd: string;
  storeName: string;
  ui: TodoUI;
}
