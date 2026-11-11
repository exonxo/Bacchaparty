import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { findActiveRoom } from "@/lib/rooms";
import { getUser } from "@/lib/supabase/server";
import { HostScreen } from "./HostScreen";

export const dynamic = "force-dynamic";

export default async function HostRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  if (isSupabaseConfigured) {
    const user = await getUser();
    if (!user) redirect(`/login?next=/room/${code}/host`);
    const room = await findActiveRoom(code);
    if (!room || room.host_id !== user.id) redirect("/host");
  }
  return <HostScreen code={code} />;
}
