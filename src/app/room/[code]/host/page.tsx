import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { findActiveRoom } from "@/lib/rooms";
import { getUser } from "@/lib/supabase/server";
import { HostScreen } from "./HostScreen";

export const dynamic = "force-dynamic";

export default async function HostRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  let defaultName = "";
  if (isSupabaseConfigured) {
    const user = await getUser();
    if (!user) redirect(`/login?next=/room/${code}/host`);
    const room = await findActiveRoom(code);
    if (!room || room.host_id !== user.id) redirect("/host");
    const full = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? "") as string;
    defaultName = full.split(" ")[0]?.slice(0, 16) ?? "";
  }
  return <HostScreen code={code} defaultName={defaultName} />;
}
