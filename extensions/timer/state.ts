import { randomBytes } from "node:crypto";

export interface TimerEntry {
  id: string;
  prompt: string;
  intervalMs: number;
  recurring: boolean;
  durationStr: string;
  handle: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>;
  createdAt: number;
}

export interface TimerInfo {
  id: string;
  prompt: string;
  durationStr: string;
  recurring: boolean;
  createdAt: number;
}

export interface CreateTimerOptions {
  prompt: string;
  intervalMs: number;
  durationStr: string;
  recurring: boolean;
  onFire: (id: string) => void;
}

const timers = new Map<string, TimerEntry>();

function generateId(): string {
  return randomBytes(3).toString("hex");
}

export function createTimer(options: CreateTimerOptions): TimerEntry {
  const { prompt, intervalMs, durationStr, recurring, onFire } = options;
  const id = generateId();

  let handle: TimerEntry["handle"];

  if (recurring) {
    handle = setInterval(() => {
      onFire(id);
    }, intervalMs);
  } else {
    handle = setTimeout(() => {
      onFire(id);
      timers.delete(id);
    }, intervalMs);
  }

  const entry: TimerEntry = {
    id,
    prompt,
    intervalMs,
    recurring,
    durationStr,
    handle,
    createdAt: Date.now(),
  };

  timers.set(id, entry);
  return entry;
}

export function cancelTimer(id: string): boolean {
  const entry = timers.get(id);
  if (!entry) return false;

  if (entry.recurring) {
    clearInterval(entry.handle);
  } else {
    clearTimeout(entry.handle);
  }

  timers.delete(id);
  return true;
}

export function listTimers(): TimerInfo[] {
  return Array.from(timers.values()).map(({ id, prompt, durationStr, recurring, createdAt }) => ({
    id,
    prompt,
    durationStr,
    recurring,
    createdAt,
  }));
}

export function clearAll(): void {
  for (const entry of timers.values()) {
    if (entry.recurring) {
      clearInterval(entry.handle);
    } else {
      clearTimeout(entry.handle);
    }
  }
  timers.clear();
}

export function getTimerCount(): number {
  return timers.size;
}
