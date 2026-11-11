"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getGameInfo } from "@/games/catalog";
import { getGameModule } from "@/games/modules";
import { isSupabaseConfigured } from "./env";
import { openRoom, type RoomTransport } from "./transport";
import {
  LEAVE_ACTION,
  PROTOCOL,
  type ActionBody,
  type ActionEnvelope,
  type JoinBody,
  type JoinEnvelope,
  type PrivateBody,
  type PrivateEnvelope,
  type RoomSnapshot,
  type SignedRoom,
} from "./room";
import { deriveShared, generateExchangeKeys, generateSigningKeys, importSigner, open, seal, serialQueue, sign, type StoredKeyPair } from "./secure";
import { HOST_ID, type GameAction, type Player } from "./types";
import type { Identity } from "./usePlayerRoom";
import { AVATARS, randomId } from "./util";

interface HostState {
  players: Player[];
  phase: "lobby" | "playing" | "closed";
  gameId: string | null;
  gameState: unknown;
  together: boolean;
  /** Players the host removed. */
  kicked: string[];
  /** Each player's key-exchange public key; the first one seen for an id is kept. */
  keys: Record<string, string>;
  /** Total time the game clock has been paused (host phone in the background). */
  pausedMs: number;
  savedAt: number;
}

interface HostKeys {
  sign: StoredKeyPair;
  ecdh: StoredKeyPair;
}

/**
 * checking: looking for another device already hosting this room.
 * blocked:  another device is hosting; the user can take over.
 * active:   this device runs the room.
 * yielded:  another device took over.
 */
export type HostRole = "checking" | "blocked" | "active" | "yielded";

const empty: HostState = { players: [], phase: "lobby", gameId: null, gameState: null, together: true, kicked: [], keys: {}, pausedMs: 0, savedAt: 0 };
const STATE_PREFIX = "bacchaparty-host-";
const KEYS_PREFIX = "bacchaparty-hostkeys-";
const DAY = 24 * 60 * 60 * 1000;
const MAX_PLAYERS = 50;
const DEMO_OWNER_KEY = "bacchaparty-demo-host-owner";

/** Presence id for an active host tab (auth user id + tab id, not socket ref). */
export function hostPresenceId(ownerId: string, tabId: string) {
  return `host:${ownerId}:${tabId}`;
}

export function parseHostPresence(id: string): { ownerId: string; tabId: string } | null {
  if (!id.startsWith("host:")) return null;
  const rest = id.slice(5);
  const sep = rest.indexOf(":");
  if (sep <= 0 || sep >= rest.length - 1) return null;
  return { ownerId: rest.slice(0, sep), tabId: rest.slice(sep + 1) };
}

/** Demo mode has no auth user; one browser profile gets a stable owner id. */
export function demoHostOwnerId(): string {
  try {
    let id = localStorage.getItem(DEMO_OWNER_KEY);
    if (!id) {
      id = randomId(16);
      localStorage.setItem(DEMO_OWNER_KEY, id);
    }
    return id;
  } catch {
    return randomId(16);
  }
}

function loadState(code: string): HostState | null {
  try {
    // Forget rooms from other nights so storage doesn't fill up.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k?.startsWith(STATE_PREFIX)) continue;
      const savedAt = (JSON.parse(localStorage.getItem(k) ?? "{}") as Partial<HostState>).savedAt ?? 0;
      if (Date.now() - savedAt > DAY) {
        localStorage.removeItem(k);
        localStorage.removeItem(KEYS_PREFIX + k.slice(STATE_PREFIX.length));
      }
    }
    const raw = localStorage.getItem(STATE_PREFIX + code);
    if (!raw) return null;
    return { ...empty, ...(JSON.parse(raw) as HostState) };
  } catch {
    return null;
  }
}

async function loadKeys(code: string, rotateSigning: boolean): Promise<HostKeys> {
  let keys: HostKeys | null = null;
  try {
    const raw = localStorage.getItem(KEYS_PREFIX + code);
    if (raw) keys = JSON.parse(raw) as HostKeys;
  } catch {}
  if (!keys) keys = { sign: await generateSigningKeys(), ecdh: await generateExchangeKeys() };
  else if (rotateSigning) keys = { ...keys, sign: await generateSigningKeys() };
  try {
    localStorage.setItem(KEYS_PREFIX + code, JSON.stringify(keys));
  } catch {}
  return keys;
}

interface KeyInfo {
  hostKey: string | null;
  demo: boolean;
}

async function fetchKeyInfo(code: string): Promise<KeyInfo | null> {
  try {
    const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
    const data = (await res.json()) as { hostKey?: string | null; demo?: boolean };
    return { hostKey: data.hostKey ?? null, demo: !!data.demo };
  } catch {
    return null;
  }
}

async function registerKey(code: string, key: string) {
  try {
    await fetch(`/api/rooms/${code}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key }) });
  } catch {}
}

/**
 * Runs a room on the host's device. The host is also a player (`me`), so the
 * host's phone can play while it runs the game.
 */
export function useHostRoom(code: string, me: Identity | null, ownerAuthId: string | null = null) {
  const stateRef = useRef<HostState>(empty);
  const [state, setStateRaw] = useState<HostState>(empty);
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [role, setRoleRaw] = useState<HostRole>("checking");
  const roleRef = useRef<HostRole>("checking");
  const meRef = useRef(me);
  meRef.current = me;

  /** Wired up inside the main effect. */
  const api = useRef<{ flush: (forceFor?: string) => void; save: () => void; takeOver: () => void }>({ flush: () => {}, save: () => {}, takeOver: () => {} });

  /** Set while the host's page is hidden; the game clock stands still meanwhile. */
  const hiddenAtRef = useRef(0);
  const gameNow = useCallback(() => (hiddenAtRef.current || Date.now()) - stateRef.current.pausedMs, []);

  const commit = useCallback((next: HostState) => {
    if (next === stateRef.current) return;
    stateRef.current = next;
    setStateRaw(next);
    api.current.flush();
    api.current.save();
  }, []);

  const applyAction = useCallback(
    (action: GameAction) => {
      const s = stateRef.current;
      if (roleRef.current !== "active" || s.phase !== "playing" || !s.gameId) return;
      const mod = getGameModule(s.gameId);
      if (!mod) return;
      let gameState: unknown;
      try {
        gameState = mod.reduce(s.gameState, action, { players: s.players, now: gameNow() });
      } catch (e) {
        console.error("Game reducer error", e);
        return;
      }
      if (gameState !== s.gameState) commit({ ...s, gameState });
    },
    [commit, gameNow],
  );

  /** Adds a player, or updates their name/icon. Icons are kept unique while any are free. */
  const upsertPlayer = useCallback(
    (id: string, rawName: string, rawAvatar: string, pk?: string) => {
      const s = stateRef.current;
      const name = rawName.trim().slice(0, 16);
      if (!name) return;
      const taken = new Set(s.players.filter((p) => p.id !== id).map((p) => p.avatar));
      const all = AVATARS as readonly string[];
      let avatar = all.includes(rawAvatar) ? rawAvatar : all[0];
      if (taken.has(avatar)) avatar = all.find((a) => !taken.has(a)) ?? avatar;
      const keys = pk && !s.keys[id] ? { ...s.keys, [id]: pk } : s.keys;
      const existing = s.players.find((p) => p.id === id);
      if (existing) {
        if (existing.name === name && existing.avatar === avatar && existing.connected && keys === s.keys) return;
        commit({ ...s, keys, players: s.players.map((p) => (p.id === id ? { ...p, name, avatar, connected: true } : p)) });
        return;
      }
      if (s.players.length >= MAX_PLAYERS) return;
      const player: Player = { id, name, avatar, connected: true };
      const mod = s.gameId ? getGameModule(s.gameId) : null;
      const gameState = s.phase === "playing" && mod?.onPlayerJoin ? mod.onPlayerJoin(s.gameState, player) : s.gameState;
      commit({ ...s, keys, players: [...s.players, player], gameState });
    },
    [commit],
  );

  // The host's own player.
  useEffect(() => {
    if (me) upsertPlayer(me.id, me.name, me.avatar);
  }, [me, upsertPlayer]);

  useEffect(() => {
    let disposed = false;
    const tabId = randomId(8);
    const epoch = Date.now();
    let seq = 0;
    let keys: HostKeys | null = null;
    let signer: CryptoKey | null = null;
    const shared = new Map<string, { pk: string; key: CryptoKey }>();
    const lastPrivate = new Map<string, string>();
    const lastActionN = new Map<string, number>();
    const lastSyncAt = new Map<string, number>();
    const force = new Set<string>();
    const recentJoins: number[] = [];
    const joinedAt = new Map<string, number>();
    const queue = serialQueue();
    let demo = false;

    const setRole = (r: HostRole) => {
      roleRef.current = r;
      setRoleRaw(r);
    };

    const saved = loadState(code);
    if (saved) {
      // Time spent closed or reloading doesn't count against game timers.
      if (saved.savedAt && Date.now() - saved.savedAt > 5000) saved.pausedMs += Date.now() - saved.savedAt;
      saved.players = saved.players.map((p) => ({ ...p, connected: p.id === meRef.current?.id }));
      stateRef.current = saved;
      setStateRaw(saved);
      // Make sure the host's own player is in the restored room.
      const self = meRef.current;
      if (self) upsertPlayer(self.id, self.name, self.avatar);
    }

    const t: RoomTransport = openRoom(code);
    const ownerId = ownerAuthId ?? (isSupabaseConfigured ? "" : demoHostOwnerId());

    // --- saving (at most once a second) ---
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const saveNow = () => {
      saveTimer = null;
      if (roleRef.current !== "active") return;
      try {
        localStorage.setItem(STATE_PREFIX + code, JSON.stringify({ ...stateRef.current, savedAt: Date.now() }));
      } catch {}
    };
    const save = () => {
      if (!saveTimer) saveTimer = setTimeout(saveNow, 1000);
    };

    // --- broadcasting (signed snapshot + encrypted private views) ---
    const sharedFor = async (id: string) => {
      const pk = stateRef.current.keys[id];
      if (!pk || !keys) return null;
      const hit = shared.get(id);
      if (hit?.pk === pk) return hit.key;
      try {
        const key = await deriveShared(keys.ecdh, pk);
        shared.set(id, { pk, key });
        return key;
      } catch {
        return null;
      }
    };

    let dirty = false;
    let flushing = false;
    const run = async () => {
      flushing = true;
      try {
        while (dirty && !disposed && roleRef.current === "active" && keys && signer) {
          dirty = false;
          const forced = new Set(force);
          force.clear();
          const s = stateRef.current;
          const mod = s.gameId ? getGameModule(s.gameId) : null;
          const playing = s.phase === "playing" && mod && s.gameState;
          const mySeq = ++seq;
          const snap: RoomSnapshot = {
            code,
            phase: s.phase,
            gameId: s.gameId,
            players: s.players,
            hostPlayerId: meRef.current?.id ?? null,
            together: s.together,
            view: playing ? mod.publicView(s.gameState) : null,
            hostNow: gameNow(),
            epoch,
            seq: mySeq,
            hostEcdh: keys.ecdh.publicKey,
            kicked: s.kicked,
          };
          const d = JSON.stringify(snap);
          const msg: SignedRoom = { v: PROTOCOL, d, s: await sign(signer, d), k: keys.sign.publicKey };
          t.send("room", msg);
          if (playing && mod.privateView) {
            for (const p of s.players) {
              if (p.id === meRef.current?.id) continue;
              const data = mod.privateView(s.gameState, p.id) ?? null;
              const json = JSON.stringify(data);
              if (!forced.has(p.id) && lastPrivate.get(p.id) === json) continue;
              const key = await sharedFor(p.id);
              if (!key) continue;
              lastPrivate.set(p.id, json);
              const body: PrivateBody = { epoch, seq: mySeq, data };
              const env: PrivateEnvelope = { to: p.id, ...(await seal(key, body)) };
              t.send("private", env);
            }
          }
        }
      } catch (e) {
        console.error("broadcast failed", e);
      } finally {
        flushing = false;
      }
    };
    const flush = (forceFor?: string) => {
      if (forceFor) force.add(forceFor);
      dirty = true;
      if (!flushing) void run();
    };

    // --- becoming (or stopping being) the host ---
    const activate = async (takeover: boolean) => {
      keys = await loadKeys(code, takeover);
      signer = await importSigner(keys.sign);
      if (disposed) return;
      const info = await fetchKeyInfo(code);
      demo = info?.demo ?? false;
      if (!demo && info?.hostKey !== keys.sign.publicKey) await registerKey(code, keys.sign.publicKey);
      if (disposed) return;
      setRole("active");
      t.track(ownerId ? hostPresenceId(ownerId, tabId) : `host:${tabId}`);
      if (takeover) t.send("host", { t: "takeover", tab: tabId });
      lastPrivate.clear();
      flush();
    };

    let lastYieldCheck = 0;
    const checkYield = async (asked: boolean) => {
      if (roleRef.current !== "active" || !keys || Date.now() - lastYieldCheck < 3000) return;
      lastYieldCheck = Date.now();
      if (demo) {
        // No server to ask in demo mode, so a takeover request is trusted.
        if (asked) setRole("yielded");
        return;
      }
      const info = await fetchKeyInfo(code);
      if (info?.hostKey && info.hostKey !== keys.sign.publicKey) setRole("yielded");
    };

    api.current = {
      flush,
      save,
      takeOver: () => {
        if (roleRef.current === "blocked" || roleRef.current === "yielded") void activate(true);
      },
    };

    t.onStatus((st) => {
      setStatus(st);
      if (st === "connected") flush();
    });
    t.track(`cand:${tabId}`);

    let presenceRounds = 0;
    let otherHost = false;
    /** True once another tab is actively broadcasting room state (not mere stale presence). */
    let seenRemoteRoom = false;

    const presenceHostConflict = (ids: string[]) => {
      if (!ownerId) return ids.some((id) => id.startsWith("host:"));
      for (const id of ids) {
        const who = parseHostPresence(id);
        if (!who) continue;
        if (who.ownerId !== ownerId) return true;
        if (who.tabId !== tabId) return seenRemoteRoom;
      }
      return false;
    };

    const decide = () => {
      if (roleRef.current !== "checking") return;
      if (otherHost) setRole("blocked");
      else void activate(false);
    };
    const decideTimer = setTimeout(decide, 3500);

    const offRoomPeek = t.on("room", () => {
      if (seenRemoteRoom) return;
      seenRemoteRoom = true;
      if (roleRef.current === "checking") {
        otherHost = presenceHostConflict(latestPresence);
        if (presenceRounds >= 1) decide();
      }
    });
    let latestPresence: string[] = [];

    t.onPresence((ids) => {
      latestPresence = ids;
      otherHost = presenceHostConflict(ids);
      presenceRounds++;
      if (roleRef.current === "checking" && presenceRounds >= 2) decide();
      if (roleRef.current !== "active") return;
      const s = stateRef.current;
      const online = new Set(ids);
      const hostId = meRef.current?.id;
      const nowMs = Date.now();
      let changed = false;
      const back: Player[] = [];
      const players = s.players.map((p) => {
        // A phone that joined a moment ago may not have shown up in presence yet.
        const fresh = nowMs - (joinedAt.get(p.id) ?? 0) < 6000;
        const c = p.id === hostId || online.has(p.id) || (fresh && p.connected);
        if (c === p.connected) return p;
        changed = true;
        const next = { ...p, connected: c };
        if (c) back.push(next);
        return next;
      });
      if (!changed) return;
      // Someone who was away when the game started gets dealt in when they're back.
      let gameState = s.gameState;
      const mod = s.gameId ? getGameModule(s.gameId) : null;
      if (s.phase === "playing" && mod?.onPlayerJoin) for (const p of back) gameState = mod.onPlayerJoin(gameState, p);
      commit({ ...s, players, gameState });
    });

    const isSealed = (m: { iv?: unknown; ct?: unknown }, max: number) =>
      typeof m.iv === "string" && typeof m.ct === "string" && m.iv.length <= 32 && m.ct.length <= max;

    const offJoin = t.on("join", (m: JoinEnvelope) =>
      queue(async () => {
        if (roleRef.current !== "active" || !keys) return;
        if (!m || typeof m.id !== "string" || !m.id || m.id.length > 24 || typeof m.pk !== "string" || m.pk.length > 200 || !isSealed(m, 600)) return;
        const s = stateRef.current;
        if (s.phase === "closed") return;
        if (m.id === meRef.current?.id || m.id === HOST_ID || s.kicked.includes(m.id)) return;
        const isNew = !s.players.some((p) => p.id === m.id);
        if (isNew) {
          const now = Date.now();
          while (recentJoins.length && now - recentJoins[0] > 2000) recentJoins.shift();
          if (recentJoins.length >= 8 || s.players.length >= MAX_PLAYERS) return;
        }
        // An id stays bound to the first key that joined with it.
        const pk = s.keys[m.id] ?? m.pk;
        let key: CryptoKey;
        try {
          key = shared.get(m.id)?.pk === pk ? shared.get(m.id)!.key : await deriveShared(keys.ecdh, pk);
        } catch {
          return;
        }
        const body = await open<JoinBody>(key, m);
        if (!body || typeof body.name !== "string" || typeof body.avatar !== "string") return;
        shared.set(m.id, { pk, key });
        if (isNew) recentJoins.push(Date.now());
        joinedAt.set(m.id, Date.now());
        upsertPlayer(m.id, body.name, body.avatar, pk);
        lastPrivate.delete(m.id);
        flush(m.id);
      }),
    );

    const offSync = t.on("sync", (m: { id?: unknown }) => {
      if (roleRef.current !== "active") return;
      const id = typeof m?.id === "string" ? m.id.slice(0, 24) : "";
      const now = Date.now();
      if (now - (lastSyncAt.get(id) ?? 0) < 1000) return;
      if (lastSyncAt.size > 500) lastSyncAt.clear();
      lastSyncAt.set(id, now);
      flush(id || undefined);
    });

    const offAction = t.on("action", (m: ActionEnvelope) =>
      queue(async () => {
        if (roleRef.current !== "active") return;
        if (!m || typeof m.from !== "string" || !isSealed(m, 400_000)) return;
        const s = stateRef.current;
        if (m.from === meRef.current?.id || !s.players.some((p) => p.id === m.from)) return;
        const key = await sharedFor(m.from);
        if (!key) return;
        const body = await open<ActionBody>(key, m);
        if (!body || typeof body.type !== "string" || typeof body.n !== "number") return;
        if (body.n <= (lastActionN.get(m.from) ?? 0)) return; // replayed
        lastActionN.set(m.from, body.n);
        if (body.type === LEAVE_ACTION) {
          const cur = stateRef.current;
          commit({ ...cur, players: cur.players.filter((p) => p.id !== m.from) });
          return;
        }
        applyAction({ playerId: m.from, type: body.type, payload: body.payload });
      }),
    );

    const offHost = t.on("host", (m: { tab?: string }) => {
      if (m?.tab !== tabId) void checkYield(true);
    });

    const tick = setInterval(() => {
      const s = stateRef.current;
      if (roleRef.current !== "active" || s.phase !== "playing" || !s.gameId) return;
      const mod = getGameModule(s.gameId);
      if (!mod?.tick) return;
      try {
        const gameState = mod.tick(s.gameState, { players: s.players, now: gameNow() });
        if (gameState !== s.gameState) commit({ ...s, gameState });
      } catch (e) {
        console.error("Game tick error", e);
      }
    }, 500);

    // Heartbeat: lets phones notice a missing host and keeps clocks in sync.
    const hb = setInterval(() => {
      flush();
      save();
    }, 4000);
    const keyCheck = setInterval(() => void checkYield(false), 30000);

    // While the host's phone is in the background the game clock stops,
    // so turns and timers don't run out while they're sending an invite.
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        saveNow();
        return;
      }
      const away = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
      hiddenAtRef.current = 0;
      const s = stateRef.current;
      if (away > 0 && roleRef.current === "active") commit({ ...s, pausedMs: s.pausedMs + away });
      else flush();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", saveNow);

    return () => {
      disposed = true;
      saveNow();
      if (saveTimer) clearTimeout(saveTimer);
      clearTimeout(decideTimer);
      offRoomPeek();
      offJoin();
      offSync();
      offAction();
      offHost();
      clearInterval(tick);
      clearInterval(hb);
      clearInterval(keyCheck);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", saveNow);
      t.close();
      api.current = { flush: () => {}, save: () => {}, takeOver: () => {} };
    };
  }, [code, ownerAuthId, commit, applyAction, upsertPlayer, gameNow]);

  const startGame = useCallback(
    (gameId: string, options: unknown) => {
      const mod = getGameModule(gameId);
      const info = getGameInfo(gameId);
      if (!mod || roleRef.current !== "active") return;
      const s = stateRef.current;
      const players = s.players.filter((p) => p.connected);
      if (info && (players.length < info.minPlayers || players.length > info.maxPlayers)) return;
      const gameState = mod.init({ players, options: options ?? mod.defaultOptions, now: gameNow() });
      commit({ ...s, phase: "playing", gameId, gameState });
    },
    [commit, gameNow],
  );

  const endGame = useCallback(() => {
    commit({ ...stateRef.current, phase: "lobby", gameId: null, gameState: null });
  }, [commit]);

  const endParty = useCallback(() => {
    if (roleRef.current !== "active") return;
    const s = { ...stateRef.current, phase: "closed" as const, gameId: null, gameState: null };
    stateRef.current = s;
    setStateRaw(s);
    api.current.flush();
    try {
      localStorage.removeItem(STATE_PREFIX + code);
      localStorage.removeItem(KEYS_PREFIX + code);
    } catch {}
    void fetch(`/api/rooms/${code}/close`, { method: "POST" });
  }, [code]);

  /** Removes a player for good: their phone is told and can't rejoin this room. */
  const removePlayer = useCallback(
    (id: string) => {
      const s = stateRef.current;
      if (id === meRef.current?.id) return;
      commit({ ...s, players: s.players.filter((p) => p.id !== id), kicked: [...s.kicked.filter((k) => k !== id), id].slice(-100) });
    },
    [commit],
  );

  const setTogether = useCallback((together: boolean) => commit({ ...stateRef.current, together }), [commit]);

  const act = useCallback((type: string, payload?: unknown) => applyAction({ playerId: HOST_ID, type, payload }), [applyAction]);
  const sendAsMe = useCallback(
    (type: string, payload?: unknown) => {
      if (meRef.current) applyAction({ playerId: meRef.current.id, type, payload });
    },
    [applyAction],
  );
  const takeOver = useCallback(() => api.current.takeOver(), []);

  const mod = state.gameId ? getGameModule(state.gameId) : null;
  const playing = state.phase === "playing" && mod && state.gameState;
  const view = playing ? mod.publicView(state.gameState) : null;
  const myPriv = playing && me && mod.privateView ? mod.privateView(state.gameState, me.id) : undefined;

  return { state, status, role, view, myPriv, clockOffset: -state.pausedMs, startGame, endGame, endParty, removePlayer, setTogether, takeOver, act, sendAsMe };
}
