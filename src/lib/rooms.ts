import { getServerSupabase } from "./supabase/server";

/** Rooms are valid for 24 hours after creation. */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export async function findActiveRoom(code: string) {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const since = new Date(Date.now() - ROOM_TTL_MS).toISOString();
  const { data } = await supabase
    .from("rooms")
    .select("id, code, host_id, created_at")
    .eq("code", code.toUpperCase())
    .is("closed_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
