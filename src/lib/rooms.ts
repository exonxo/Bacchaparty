import { getServerSupabase } from "./supabase/server";
import { makeRoomCode } from "./util";

/** Rooms are valid for 24 hours after creation. */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

const since = () => new Date(Date.now() - ROOM_TTL_MS).toISOString();

/**
 * The signed-in host's own active room with this code (null if it isn't theirs).
 * Works with both the old and the new database policies.
 */
export async function findOwnRoom(code: string, userId: string) {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("rooms")
    .select("id, code, host_id, created_at")
    .eq("code", code.toUpperCase())
    .eq("host_id", userId)
    .is("closed_at", null)
    .gte("created_at", since())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * Public lookup by code: does the room exist, and which signing key is its host's.
 * Uses the `room_lookup` function (migration 0002); falls back to reading the
 * table directly on databases that haven't been migrated yet.
 */
export type RoomLookup = { exists: boolean; hostKey: string | null; ended: boolean };

export async function lookupRoom(code: string): Promise<RoomLookup> {
  const supabase = await getServerSupabase();
  if (!supabase) return { exists: false, hostKey: null, ended: false };
  const upper = code.toUpperCase();
  const rpc = await supabase.rpc("room_lookup", { p_code: upper });
  if (!rpc.error) {
    const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    if (row) return { exists: true, hostKey: (row.host_key as string | null) ?? null, ended: false };
    const endedRpc = await supabase.rpc("room_is_ended", { p_code: upper });
    if (!endedRpc.error && endedRpc.data === true) return { exists: false, hostKey: null, ended: true };
    return { exists: false, hostKey: null, ended: false };
  }
  const { data } = await supabase
    .from("rooms")
    .select("id, closed_at")
    .eq("code", upper)
    .gte("created_at", since())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { exists: false, hostKey: null, ended: false };
  if (data.closed_at) return { exists: false, hostKey: null, ended: true };
  return { exists: true, hostKey: null, ended: false };
}

/** Marks the signed-in host's room as closed. Returns false if Supabase is missing or RPC failed. */
export async function closeRoom(code: string): Promise<boolean> {
  const supabase = await getServerSupabase();
  if (!supabase) return false;
  const { error } = await supabase.rpc("close_room", { p_code: code.toUpperCase() });
  if (!error) return true;
  const user = await supabase.auth.getUser();
  if (!user.data.user) return false;
  const { error: upd } = await supabase
    .from("rooms")
    .update({ closed_at: new Date().toISOString() })
    .eq("code", code.toUpperCase())
    .eq("host_id", user.data.user.id)
    .is("closed_at", null)
    .gte("created_at", since());
  return !upd;
}

/** Creates a room for the signed-in user and returns its code. */
export async function createRoom(userId: string): Promise<string | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const rpc = await supabase.rpc("create_room");
  if (!rpc.error && typeof rpc.data === "string") return rpc.data;
  // Older database: insert directly.
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeRoomCode();
    if ((await lookupRoom(code)).exists) continue;
    const { error } = await supabase.from("rooms").insert({ code, host_id: userId });
    if (!error) return code;
    console.error("room insert failed", error.message);
  }
  return null;
}

/** Records the host's signing key for their room. Returns false on older databases. */
export async function setRoomKey(code: string, key: string): Promise<boolean> {
  const supabase = await getServerSupabase();
  if (!supabase) return false;
  const { error } = await supabase.rpc("set_room_key", { p_code: code.toUpperCase(), p_key: key });
  return !error;
}
