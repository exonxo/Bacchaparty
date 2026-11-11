import { NextResponse } from "next/server";
import { createRoom } from "@/lib/rooms";
import { getServerSupabase } from "@/lib/supabase/server";
import { makeRoomCode } from "@/lib/util";

/** Create a room for the signed-in host. */
export async function POST() {
  const supabase = await getServerSupabase();
  if (!supabase) return NextResponse.json({ code: makeRoomCode(), demo: true });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const code = await createRoom(auth.user.id);
  if (!code) return NextResponse.json({ error: "Could not create a room, please retry" }, { status: 500 });
  return NextResponse.json({ code });
}
