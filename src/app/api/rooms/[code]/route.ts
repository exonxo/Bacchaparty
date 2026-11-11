import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { findActiveRoom } from "@/lib/rooms";

/** Lets the join page check that a code is real before connecting. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Za-z]{4}$/.test(code)) return NextResponse.json({ exists: false });
  if (!isSupabaseConfigured) return NextResponse.json({ exists: true, demo: true });
  const room = await findActiveRoom(code);
  return NextResponse.json({ exists: Boolean(room) });
}
