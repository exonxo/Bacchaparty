import { NextResponse } from "next/server";
import { findActiveRoom } from "@/lib/rooms";
import { getServerSupabase } from "@/lib/supabase/server";
import { makeRoomCode } from "@/lib/util";

/** Create a room for the signed-in host. */
export async function POST() {
  const supabase = await getServerSupabase();
  if (!supabase) return NextResponse.json({ code: makeRoomCode(), demo: true });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeRoomCode();
    if (await findActiveRoom(code)) continue;
    const { error } = await supabase.from("rooms").insert({ code, host_id: auth.user.id });
    if (!error) return NextResponse.json({ code });
    console.error("room insert failed", error.message);
  }
  return NextResponse.json({ error: "Could not create a room, please retry" }, { status: 500 });
}
