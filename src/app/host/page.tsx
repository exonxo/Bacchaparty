import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";
import { CreateRoom } from "./CreateRoom";

export const dynamic = "force-dynamic";

export default async function HostPage() {
  if (isSupabaseConfigured && !(await getUser())) redirect("/login?next=/host");
  return <CreateRoom />;
}
