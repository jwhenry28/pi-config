export function warn(ctx: RosettaNotifyContext | undefined, message: string): void {
  notify(ctx, message, "warning");
}

export function notify(
  ctx: RosettaNotifyContext | undefined,
  message: string,
  level: "info" | "warning" | "error",
): void {
  ctx?.ui?.notify?.(message, level);
}

export type RosettaNotifyContext = {
  ui?: {
    notify?: (msg: string, level: "info" | "warning" | "error") => void;
  };
};
