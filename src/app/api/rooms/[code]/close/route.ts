import { NextResponse } from "next/server";
import { isDemoPartyClosed, markDemoPartyClosed } from "@/lib/demoParty";
import { isSupabaseConfigured } from "@/lib/env";
import { closeRoom, findOwnRoom } from "@/lib/rooms";
import { getUser } from "@/lib/supabase/server";

const noStore = { "cache-control": "no-store" };

/** Host ends the party: marks the room closed in Supabase (or demo registry). */
export async function POST(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Za-z]{4}$/.test(code)) return NextResponse.json({ ok: false }, { status: 400, headers: noStore });
  if (!isSupabaseConfigured) {
    markDemoPartyClosed(code);
    return NextResponse.json({ ok: true, demo: true }, { headers: noStore });
  }
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  const own = await findOwnRoom(code, user.id);
  if (!own) return NextResponse.json({ ok: false }, { status: 403, headers: noStore });
  const ok = await closeRoom(code);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500, headers: noStore });
}

/** Join flow can poll whether a demo room was closed (server has no DB). */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Za-z]{4}$/.test(code)) return NextResponse.json({ ended: false }, { headers: noStore });
  if (isSupabaseConfigured) return NextResponse.json({ ended: false }, { headers: noStore });
  return NextResponse.json({ ended: isDemoPartyClosed(code) }, { headers: noStore });
}
