"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { openRoom, type RoomTransport } from "./transport";
import { LEAVE_ACTION, PROTOCOL, type ActionBody, type ActionEnvelope, type JoinBody, type JoinEnvelope, type PrivateBody, type PrivateEnvelope, type RoomSnapshot, type SignedRoom } from "./room";
import { createClockSync, createRoomReceiver } from "./roomReceiver";
import { deriveShared, generateExchangeKeys, open, seal, serialQueue, type StoredKeyPair } from "./secure";
import type { Player } from "./types";
import { isSupabaseConfigured } from "./env";
import { AVATARS, pick, randomId } from "./util";

export interface Identity {
  id: string;
  name: string;
  avatar: string;
  /** Key pair that proves this phone is this player (made on first join). */
  keys?: StoredKeyPair;
}

const KEY = "bacchaparty-me";

/** In demo mode every tab is a separate "phone", so identity lives per tab. */
function store(): Storage {
  return isSupabaseConfigured ? localStorage : sessionStorage;
}

export function loadIdentity(): Identity {
  try {
    const raw = store().getItem(KEY);
    if (raw) {
      const me = JSON.parse(raw) as Identity;
      // Older versions used emoji avatars.
      if (!(AVATARS as readonly string[]).includes(me.avatar)) me.avatar = pick(AVATARS);
      return me;
    }
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
  const [kicked, setKicked] = useState(false);
  /** The host (or this phone) is running a different version of the app. */
  const [mismatch, setMismatch] = useState(false);
  const [lastRoomAt, setLastRoomAt] = useState(0);
  const transportRef = useRef<RoomTransport | null>(null);
  const sharedRef = useRef<CryptoKey | null>(null);
  const counter = useRef(0);
  const leftRef = useRef(false);

  useEffect(() => {
    if (!me) return;
    let closed = false;
    const t = openRoom(code);
    transportRef.current = t;
    const receiver = createRoomReceiver(code);
    const clock = createClockSync();
    const queue = serialQueue();
    let keys = me.keys;
    let sharedWith = "";
    let lastJoin = 0;
    let gotRoom = false;
    let playing = false;
    let gotPriv = false;
    let privEpoch = 0;
    let privSeq = 0;
    let avatar = me.avatar;

    const ensureShared = async (hostEcdh: string) => {
      if (!keys) {
        keys = await generateExchangeKeys();
        saveIdentity({ ...me, avatar, keys });
      }
      if (sharedWith !== hostEcdh) {
        sharedRef.current = await deriveShared(keys, hostEcdh);
        sharedWith = hostEcdh;
      }
      return sharedRef.current!;
    };

    const join = async (hostEcdh: string) => {
      lastJoin = Date.now();
      const key = await ensureShared(hostEcdh);
      const body: JoinBody = { name: me.name, avatar };
      const msg: JoinEnvelope = { v: PROTOCOL, id: me.id, pk: keys!.publicKey, ...(await seal(key, body)) };
      t.send("join", msg);
    };

    t.onStatus(setStatus);
    t.track(me.id);
    t.send("sync", { id: me.id });

    const offRoom = t.on("room", (msg: SignedRoom) =>
      queue(async () => {
        if ((msg as { v?: number } | null)?.v !== PROTOCOL) {
          setMismatch(true);
          return;
        }
        const snap = await receiver.accept(msg);
        if (!snap || closed) return;
        setMismatch(false);
        gotRoom = true;
        if (snap.phase === "closed") {
          setPriv(undefined);
          setRoom(snap);
          return;
        }
        if (snap.phase !== "playing") gotPriv = false;
        playing = snap.phase === "playing";
        setOffset(clock(snap.hostNow));
        setLastRoomAt(Date.now());
        setRoom(snap);
        if (snap.kicked?.includes(me.id)) {
          setKicked(true);
          return;
        }
        await ensureShared(snap.hostEcdh);
        const self = snap.players.find((p) => p.id === me.id);
        if (!self) {
          if (!leftRef.current && Date.now() - lastJoin > 3000) await join(snap.hostEcdh);
        } else if (self.avatar !== avatar) {
          // The host gave us a different icon because ours was taken.
          avatar = self.avatar;
          saveIdentity({ ...me, avatar, keys });
        }
      }),
    );
    const offPriv = t.on("private", (m: PrivateEnvelope) =>
      queue(async () => {
        if (m?.to !== me.id || !sharedRef.current || closed) return;
        const body = await open<PrivateBody>(sharedRef.current, m);
        if (!body || body.epoch !== receiver.epoch) return;
        if (body.epoch === privEpoch && body.seq <= privSeq) return;
        privEpoch = body.epoch;
        privSeq = body.seq;
        gotPriv = body.data !== null && body.data !== undefined;
        setPriv(body.data ?? undefined);
      }),
    );
    // Keep asking until the host answers (it may still be opening the room),
    // and ask again if a game is running but our private view never arrived.
    const retry = setInterval(() => {
      if (!gotRoom || (playing && !gotPriv)) t.send("sync", { id: me.id });
    }, 3000);
    return () => {
      closed = true;
      offRoom();
      offPriv();
      clearInterval(retry);
      t.close();
      transportRef.current = null;
      sharedRef.current = null;
    };
  }, [code, me]);

  useEffect(() => {
    if (room?.phase === "lobby") setPriv(undefined);
  }, [room?.phase, room?.gameId]);

  const send = useCallback(
    (type: string, payload?: unknown) => {
      const key = sharedRef.current;
      const t = transportRef.current;
      if (!me || !key || !t) return;
      counter.current = Math.max(Date.now(), counter.current + 1);
      const body: ActionBody = { n: counter.current, type, payload };
      void seal(key, body).then((sealed) => {
        const msg: ActionEnvelope = { from: me.id, ...sealed };
        t.send("action", msg);
      });
    },
    [me],
  );

  /** Tell the host we're leaving on purpose. */
  const leave = useCallback(() => {
    leftRef.current = true;
    send(LEAVE_ACTION);
  }, [send]);

  const self: Player | undefined = room?.players.find((p) => p.id === me?.id);
  /** lastRoomAt: local time of the last genuine message from the host (0 = never). */
  return { room, priv, offset, status, send, leave, self, kicked, mismatch, lastRoomAt };
}
