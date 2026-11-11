"use client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "./supabase/client";

/**
 * Message bus for one room. In production this is a Supabase Realtime
 * broadcast channel; without Supabase it falls back to BroadcastChannel
 * (works between tabs of the same browser — handy for local testing).
 */
export type RoomEvent = "join" | "action" | "sync" | "room" | "private" | "draw";

export interface RoomTransport {
  send(event: RoomEvent, payload: unknown): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payloads are validated by each handler
  on(event: RoomEvent, handler: (payload: any) => void): () => void;
  onStatus(handler: (status: "connecting" | "connected" | "error") => void): void;
  /** Presence: who is online right now (player ids). */
  track(id: string): void;
  onPresence(handler: (ids: string[]) => void): void;
  close(): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payloads are validated by each handler
type Handler = (payload: any) => void;

class Emitter {
  private handlers = new Map<string, Set<Handler>>();
  on(event: string, h: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(h);
    return () => this.handlers.get(event)?.delete(h);
  }
  emit(event: string, payload: unknown) {
    this.handlers.get(event)?.forEach((h) => h(payload));
  }
}

class SupabaseTransport implements RoomTransport {
  private channel: RealtimeChannel;
  private emitter = new Emitter();
  private statusHandler?: (s: "connecting" | "connected" | "error") => void;
  private presenceHandler?: (ids: string[]) => void;
  private queue: [RoomEvent, unknown][] = [];
  private ready = false;
  private trackedId: string | null = null;

  constructor(code: string) {
    const supabase = getBrowserSupabase()!;
    this.channel = supabase.channel(`room:${code}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    (["join", "action", "sync", "room", "private", "draw"] as RoomEvent[]).forEach((ev) => {
      this.channel.on("broadcast", { event: ev }, (msg) => this.emitter.emit(ev, msg.payload));
    });
    this.channel.on("presence", { event: "sync" }, () => {
      const state = this.channel.presenceState<{ id: string }>();
      const ids = new Set<string>();
      Object.values(state).forEach((metas) => metas.forEach((m) => m.id && ids.add(m.id)));
      this.presenceHandler?.([...ids]);
    });
    this.statusHandler?.("connecting");
    this.channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        this.ready = true;
        this.statusHandler?.("connected");
        if (this.trackedId) this.channel.track({ id: this.trackedId });
        const q = this.queue;
        this.queue = [];
        q.forEach(([e, p]) => this.send(e, p));
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        this.ready = false;
        this.statusHandler?.("error");
      }
    });
  }
  send(event: RoomEvent, payload: unknown) {
    if (!this.ready) {
      this.queue.push([event, payload]);
      return;
    }
    void this.channel.send({ type: "broadcast", event, payload });
  }
  on(event: RoomEvent, handler: Handler) {
    return this.emitter.on(event, handler);
  }
  onStatus(handler: (s: "connecting" | "connected" | "error") => void) {
    this.statusHandler = handler;
    handler(this.ready ? "connected" : "connecting");
  }
  track(id: string) {
    this.trackedId = id;
    if (this.ready) void this.channel.track({ id });
  }
  onPresence(handler: (ids: string[]) => void) {
    this.presenceHandler = handler;
  }
  close() {
    void getBrowserSupabase()?.removeChannel(this.channel);
  }
}

/** Same-browser fallback. Presence is emulated with heartbeats. */
class LocalTransport implements RoomTransport {
  private bc: BroadcastChannel;
  private emitter = new Emitter();
  private presenceHandler?: (ids: string[]) => void;
  private seen = new Map<string, number>();
  private timer: ReturnType<typeof setInterval>;
  private trackedId: string | null = null;

  constructor(code: string) {
    this.bc = new BroadcastChannel(`bacchaparty-${code}`);
    this.bc.onmessage = (e) => {
      const { event, payload } = e.data as { event: string; payload: unknown };
      if (event === "__hb") {
        this.seen.set(payload as string, Date.now());
        return;
      }
      this.emitter.emit(event, payload);
    };
    this.timer = setInterval(() => {
      if (this.trackedId) this.bc.postMessage({ event: "__hb", payload: this.trackedId });
      const cutoff = Date.now() - 4000;
      const ids = [...this.seen.entries()].filter(([, t]) => t > cutoff).map(([id]) => id);
      if (this.trackedId) ids.push(this.trackedId);
      this.presenceHandler?.(ids);
    }, 1000);
  }
  send(event: RoomEvent, payload: unknown) {
    this.bc.postMessage({ event, payload });
  }
  on(event: RoomEvent, handler: Handler) {
    return this.emitter.on(event, handler);
  }
  onStatus(handler: (s: "connecting" | "connected" | "error") => void) {
    handler("connected");
  }
  track(id: string) {
    this.trackedId = id;
  }
  onPresence(handler: (ids: string[]) => void) {
    this.presenceHandler = handler;
  }
  close() {
    clearInterval(this.timer);
    this.bc.close();
  }
}

export function openRoom(code: string): RoomTransport {
  return getBrowserSupabase() ? new SupabaseTransport(code) : new LocalTransport(code);
}
