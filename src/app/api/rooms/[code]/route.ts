import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { lookupRoom, setRoomKey } from "@/lib/rooms";
import { getUser } from "@/lib/supabase/server";

const noStore = { "cache-control": "no-store" };

/** Lets phones check a code is real and learn which signing key belongs to its host. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Za-z]{4}$/.test(code)) return NextResponse.json({ exists: false, hostKey: null }, { headers: noStore });
  if (!isSupabaseConfigured) return NextResponse.json({ exists: true, hostKey: null, demo: true }, { headers: noStore });
  return NextResponse.json(await lookupRoom(code), { headers: noStore });
}

/** The signed-in host registers the key their device signs room updates with. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isSupabaseConfigured || !/^[A-Za-z]{4}$/.test(code)) return NextResponse.json({ ok: false }, { status: 400 });
  if (!(await getUser())) return NextResponse.json({ ok: false }, { status: 401 });
  let key: unknown;
  try {
    key = ((await req.json()) as { key?: unknown }).key;
  } catch {
    key = null;
  }
  if (typeof key !== "string" || !/^[A-Za-z0-9+/=]{80,100}$/.test(key)) return NextResponse.json({ ok: false }, { status: 400 });
  return NextResponse.json({ ok: await setRoomKey(code, key) });
}
