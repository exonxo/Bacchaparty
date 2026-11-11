"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getGameModule } from "@/games/modules";
import { openRoom, type RoomTransport } from "./transport";
import type { JoinMessage, PrivateMessage, RoomSnapshot } from "./room";
import { HOST_ID, type GameAction, type Player } from "./types";
import type { Identity } from "./usePlayerRoom";

interface HostState {
  players: Player[];
  phase: "lobby" | "playing";
  gameId: string | null;
  gameState: unknown;
  together: boolean;
}

const empty: HostState = { players: [], phase: "lobby", gameId: null, gameState: null, together: true };
const storageKey = (code: string) => `bacchaparty-host-${code}`;

/**
 * Runs a room on the host's device. The host is also a player (`me`), so the
 * host's phone can play while it runs the game. `me` may be null for a
 * TV-style host that doesn't play.
 */
export function useHostRoom(code: string, me: Identity | null) {
  const stateRef = useRef<HostState>(empty);
  const [state, setStateRaw] = useState<HostState>(empty);
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const transportRef = useRef<RoomTransport | null>(null);
  const seqRef = useRef(0);
  const lastPrivate = useRef(new Map<string, string>());
  const meRef = useRef(me);
  meRef.current = me;

  const broadcast = useCallback((s: HostState, onlyPrivateFor?: string) => {
    const t = transportRef.current;
    if (!t) return;
    const seq = ++seqRef.current;
    const mod = s.gameId ? getGameModule(s.gameId) : null;
    const view = s.phase === "playing" && mod && s.gameState ? mod.publicView(s.gameState) : null;
    const snap: RoomSnapshot = {
      code,
      phase: s.phase,
      gameId: s.gameId,
      players: s.players,
      hostPlayerId: meRef.current?.id ?? null,
      together: s.together,
      view,
      hostNow: Date.now(),
      seq,
    };
    t.send("room", snap);
    if (s.phase === "playing" && mod?.privateView && s.gameState) {
      for (const p of s.players) {
        if (p.id === meRef.current?.id) continue; // computed locally
        const data = mod.privateView(s.gameState, p.id);
        const json = JSON.stringify(data ?? null);
        if (onlyPrivateFor !== p.id && lastPrivate.current.get(p.id) === json) continue;
        lastPrivate.current.set(p.id, json);
        const msg: PrivateMessage = { to: p.id, seq, data: data ?? null };
        t.send("private", msg);
      }
    }
  }, [code]);

  const commit = useCallback((next: HostState) => {
    if (next === stateRef.current) return;
    stateRef.current = next;
    setStateRaw(next);
    broadcast(next);
    try {
      localStorage.setItem(storageKey(code), JSON.stringify(next));
    } catch {}
  }, [broadcast, code]);

  const applyAction = useCallback((action: GameAction) => {
    const s = stateRef.current;
    if (s.phase !== "playing" || !s.gameId) return;
    const mod = getGameModule(s.gameId);
    if (!mod) return;
    let gameState: unknown;
    try {
      gameState = mod.reduce(s.gameState, action, { players: s.players, now: Date.now() });
    } catch (e) {
      console.error("Game reducer error", e);
      return;
    }
    if (gameState !== s.gameState) commit({ ...s, gameState });
  }, [commit]);

  const addOrUpdatePlayer = useCallback((m: JoinMessage) => {
    const s = stateRef.current;
    const name = String(m.name).slice(0, 16);
    const existing = s.players.find((p) => p.id === m.id);
    let players: Player[];
    let gameState = s.gameState;
    if (existing) {
      if (existing.name === name && existing.avatar === m.avatar && existing.connected) return;
      players = s.players.map((p) => (p.id === m.id ? { ...p, name, avatar: m.avatar, connected: true } : p));
    } else {
      const player: Player = { id: m.id, name, avatar: m.avatar, connected: true };
      players = [...s.players, player];
      const mod = s.gameId ? getGameModule(s.gameId) : null;
      if (s.phase === "playing" && mod?.onPlayerJoin) gameState = mod.onPlayerJoin(s.gameState, player);
    }
    commit({ ...s, players, gameState });
  }, [commit]);

  // The host's own player.
  useEffect(() => {
    if (me) addOrUpdatePlayer({ id: me.id, name: me.name, avatar: me.avatar });
  }, [me, addOrUpdatePlayer]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(code));
      if (saved) {
        const parsed = { ...empty, ...(JSON.parse(saved) as HostState) };
        parsed.players = parsed.players.map((p) => ({ ...p, connected: p.id === meRef.current?.id }));
        stateRef.current = parsed;
        setStateRaw(parsed);
      }
    } catch {}

    const t = openRoom(code);
    transportRef.current = t;
    t.onStatus((st) => {
      setStatus(st);
      if (st === "connected") broadcast(stateRef.current);
    });
    t.track(meRef.current?.id ?? HOST_ID);
    t.onPresence((ids) => {
      const s = stateRef.current;
      const online = new Set(ids);
      const hostId = meRef.current?.id;
      let changed = false;
      const players = s.players.map((p) => {
        const c = p.id === hostId || online.has(p.id);
        if (c !== p.connected) changed = true;
        return c === p.connected ? p : { ...p, connected: c };
      });
      if (changed) commit({ ...s, players });
    });
    const offJoin = t.on("join", (m: JoinMessage) => {
      if (!m?.id || !m.name || m.id === meRef.current?.id) return;
      lastPrivate.current.delete(m.id);
      addOrUpdatePlayer(m);
      broadcast(stateRef.current, m.id);
    });
    const offSync = t.on("sync", (m: { id: string }) => {
      if (m?.id) lastPrivate.current.delete(m.id);
      broadcast(stateRef.current, m?.id);
    });
    const offAction = t.on("action", (a: GameAction) => {
      if (!a?.playerId || a.playerId === HOST_ID || typeof a.type !== "string") return;
      if (!stateRef.current.players.some((p) => p.id === a.playerId)) return;
      applyAction(a);
    });

    const tick = setInterval(() => {
      const s = stateRef.current;
      if (s.phase !== "playing" || !s.gameId) return;
      const mod = getGameModule(s.gameId);
      if (!mod?.tick) return;
      const gameState = mod.tick(s.gameState, { players: s.players, now: Date.now() });
      if (gameState !== s.gameState) commit({ ...s, gameState });
    }, 500);
    // Heartbeat: lets phones detect a missing host and keeps clocks in sync.
    const hb = setInterval(() => broadcast(stateRef.current, "__none"), 4000);
    // Coming back from the background: tell everyone right away.
    const onVisible = () => {
      if (document.visibilityState === "visible") broadcast(stateRef.current, "__none");
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      offJoin();
      offSync();
      offAction();
      clearInterval(tick);
      clearInterval(hb);
      document.removeEventListener("visibilitychange", onVisible);
      t.close();
      transportRef.current = null;
    };
  }, [code, broadcast, commit, applyAction, addOrUpdatePlayer]);

  const startGame = useCallback((gameId: string, options: unknown) => {
    const mod = getGameModule(gameId);
    if (!mod) return;
    const s = stateRef.current;
    const players = s.players.filter((p) => p.connected);
    lastPrivate.current.clear();
    const gameState = mod.init({ players, options: options ?? mod.defaultOptions, now: Date.now() });
    commit({ ...s, phase: "playing", gameId, gameState });
  }, [commit]);

  const endGame = useCallback(() => {
    lastPrivate.current.clear();
    commit({ ...stateRef.current, phase: "lobby", gameState: null });
  }, [commit]);

  const removePlayer = useCallback((id: string) => {
    const s = stateRef.current;
    if (id === meRef.current?.id) return;
    commit({ ...s, players: s.players.filter((p) => p.id !== id) });
  }, [commit]);

  const setTogether = useCallback((together: boolean) => commit({ ...stateRef.current, together }), [commit]);

  const act = useCallback((type: string, payload?: unknown) => applyAction({ playerId: HOST_ID, type, payload }), [applyAction]);
  const sendAsMe = useCallback(
    (type: string, payload?: unknown) => {
      if (meRef.current) applyAction({ playerId: meRef.current.id, type, payload });
    },
    [applyAction],
  );

  const mod = state.gameId ? getGameModule(state.gameId) : null;
  const playing = state.phase === "playing" && mod && state.gameState;
  const view = playing ? mod.publicView(state.gameState) : null;
  const myPriv = playing && me && mod.privateView ? mod.privateView(state.gameState, me.id) : undefined;

  return { state, status, view, myPriv, startGame, endGame, removePlayer, setTogether, act, sendAsMe };
}
