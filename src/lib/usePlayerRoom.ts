"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { openRoom, type RoomTransport } from "./transport";
import type { PrivateMessage, RoomSnapshot } from "./room";
import type { Player } from "./types";
import { isSupabaseConfigured } from "./env";
import { AVATARS, pick, randomId } from "./util";

export interface Identity {
  id: string;
  name: string;
  avatar: string;
}

const KEY = "bacchaparty-me";

/** In demo mode every tab is a separate "phone", so identity lives per tab. */
function store(): Storage {
  return isSupabaseConfigured ? localStorage : sessionStorage;
}

export function loadIdentity(): Identity {
  try {
    const raw = store().getItem(KEY);
    if (raw) return JSON.parse(raw) as Identity;
  } catch {}
  return { id: randomId(12), name: "", avatar: pick(AVATARS) };
}

export function saveIdentity(me: Identity) {
  try {
    store().setItem(KEY, JSON.stringify(me));
  } catch {}
}

export function usePlayerRoom(code: string, me: Identity | null) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [priv, setPriv] = useState<unknown>(undefined);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const transportRef = useRef<RoomTransport | null>(null);
  const lastJoin = useRef(0);
  const lastSeq = useRef(0);

  useEffect(() => {
    if (!me) return;
    const t = openRoom(code);
    transportRef.current = t;
    const join = () => {
      lastJoin.current = Date.now();
      t.send("join", { id: me.id, name: me.name, avatar: me.avatar });
    };
    t.onStatus(setStatus);
    t.track(me.id);
    join();
    const offRoom = t.on("room", (snap: RoomSnapshot) => {
      if (snap.seq < lastSeq.current && snap.seq > 5) return; // stale (host restarts reset seq)
      lastSeq.current = snap.seq;
      setOffset(snap.hostNow - Date.now());
      setRoom(snap);
      if (!snap.players.some((p) => p.id === me.id) && Date.now() - lastJoin.current > 3000) join();
    });
    const offPriv = t.on("private", (m: PrivateMessage) => {
      if (m?.to === me.id) setPriv(m.data ?? undefined);
    });
    const retry = setInterval(() => {
      if (Date.now() - lastJoin.current > 4000 && !transportRef.current) return;
      setRoom((r) => {
        if (!r) join();
        return r;
      });
    }, 4000);
    return () => {
      offRoom();
      offPriv();
      clearInterval(retry);
      t.close();
      transportRef.current = null;
    };
  }, [code, me]);

  useEffect(() => {
    if (room?.phase === "lobby") setPriv(undefined);
  }, [room?.phase, room?.gameId]);

  const send = useCallback(
    (type: string, payload?: unknown) => {
      if (!me) return;
      transportRef.current?.send("action", { playerId: me.id, type, payload });
    },
    [me],
  );

  const self: Player | undefined = room?.players.find((p) => p.id === me?.id);
  return { room, priv, offset, status, send, self };
}
