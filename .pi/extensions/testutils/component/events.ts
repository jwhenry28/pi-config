// ── Types ──────────────────────────────────────────────────────────

export interface CollectedEvent {
  type: string;
  event: unknown;
  timestamp: number;
}

// ── CollectedEvents ────────────────────────────────────────────────

export class CollectedEvents {
  private _events: CollectedEvent[] = [];

  get all(): CollectedEvent[] {
    return this._events;
  }

  push(event: any): void {
    this._events.push({
      type: event.type,
      event,
      timestamp: Date.now(),
    });
  }

  ofType(type: string): CollectedEvent[] {
    return this._events.filter((e) => e.type === type);
  }

  toolCalls(): Array<{ toolName: string; args: unknown }> {
    return this._events
      .filter((e) => e.type === "tool_execution_start")
      .map((e) => {
        const raw = e.event as any;
        return { toolName: raw.toolName, args: raw.args };
      });
  }

  toolResults(): Array<{ toolName: string; result: any; isError: boolean }> {
    return this._events
      .filter((e) => e.type === "tool_execution_end")
      .map((e) => {
        const raw = e.event as any;
        return { toolName: raw.toolName, result: raw.result, isError: raw.isError };
      });
  }

  customMessages(customType?: string): Array<{ customType: string; content: any; details: any }> {
    return this._events
      .filter((e) => e.type === "message_start" && (e.event as any).message?.role === "custom")
      .filter((e) => !customType || (e.event as any).message?.customType === customType)
      .map((e) => {
        const msg = (e.event as any).message;
        return { customType: msg.customType, content: msg.content, details: msg.details };
      });
  }

  clear(): void {
    this._events.length = 0;
  }
}
