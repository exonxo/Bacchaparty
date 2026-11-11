"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getGameModule } from "@/games/modules";
import { openRoom, type RoomTransport } from "./transport";
import type { JoinMessage, PrivateMessage, RoomSnapshot } from "./room";
import { HOST_ID, type GameAction, type Player } from "./types";

interface HostState {
  players: Player[];
  phase: "lobby" | "playing";
  gameId: string | null;
  gameState: unknown;
}

const empty: HostState = { players: [], phase: "lobby", gameId: null, gameState: null };
const storageKey = (code: string) => `bacchaparty-host-${code}`;

export function useHostRoom(code: string) {
  const stateRef = useRef<HostState>(empty);
  const [state, setStateRaw] = useState<HostState>(empty);
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const transportRef = useRef<RoomTransport | null>(null);
  const seqRef = useRef(0);
  const lastPrivate = useRef(new Map<string, string>());

  const broadcast = useCallback((s: HostState, onlyPrivateFor?: string) => {
    const t = transportRef.current;
    if (!t) return;
    const seq = ++seqRef.current;
    const mod = s.gameId ? getGameModule(s.gameId) : null;
    const view = s.phase === "playing" && mod && s.gameState ? mod.publicView(s.gameState) : null;
    const snap: RoomSnapshot = { code, phase: s.phase, gameId: s.gameId, players: s.players, view, hostNow: Date.now(), seq };
    t.send("room", snap);
    if (s.phase === "playing" && mod?.privateView && s.gameState) {
      for (const p of s.players) {
        const data = mod.privateView(s.gameState, p.id);
        const json = JSON.stringify(data ?? null);
        // Only resend private info when it changed (or when a phone asked to sync).
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(code));
      if (saved) {
        const parsed = JSON.parse(saved) as HostState;
        parsed.players = parsed.players.map((p) => ({ ...p, connected: false }));
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
    t.track(HOST_ID);
    t.onPresence((ids) => {
      const s = stateRef.current;
      const online = new Set(ids);
      let changed = false;
      const players = s.players.map((p) => {
        const c = online.has(p.id);
        if (c !== p.connected) changed = true;
        return c === p.connected ? p : { ...p, connected: c };
      });
      if (changed) commit({ ...s, players });
    });
    const offJoin = t.on("join", (m: JoinMessage) => {
      if (!m?.id || !m.name) return;
      const s = stateRef.current;
      const name = String(m.name).slice(0, 16);
      const existing = s.players.find((p) => p.id === m.id);
      let players: Player[];
      let gameState = s.gameState;
      if (existing) {
        players = s.players.map((p) => (p.id === m.id ? { ...p, name, avatar: m.avatar, connected: true } : p));
      } else {
        const player: Player = { id: m.id, name, avatar: m.avatar, connected: true };
        players = [...s.players, player];
        const mod = s.gameId ? getGameModule(s.gameId) : null;
        if (s.phase === "playing" && mod?.onPlayerJoin) gameState = mod.onPlayerJoin(s.gameState, player);
      }
      lastPrivate.current.delete(m.id);
      commit({ ...s, players, gameState });
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
    // Heartbeat so late joiners and reconnecting phones get a fresh clock.
    const hb = setInterval(() => broadcast(stateRef.current, "__none"), 5000);

    return () => {
      offJoin();
      offSync();
      offAction();
      clearInterval(tick);
      clearInterval(hb);
      t.close();
      transportRef.current = null;
    };
  }, [code, broadcast, commit, applyAction]);

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
    commit({ ...s, players: s.players.filter((p) => p.id !== id) });
  }, [commit]);

  const act = useCallback((type: string, payload?: unknown) => applyAction({ playerId: HOST_ID, type, payload }), [applyAction]);

  const mod = state.gameId ? getGameModule(state.gameId) : null;
  const view = state.phase === "playing" && mod && state.gameState ? mod.publicView(state.gameState) : null;

  return { state, status, view, startGame, endGame, removePlayer, act };
}
