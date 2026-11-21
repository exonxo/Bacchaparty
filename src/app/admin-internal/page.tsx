import { notFound } from "next/navigation";
import { adminConfig } from "@/lib/admin/config";
import { AdminApp } from "./AdminApp";

// Reached only through the secret path (middleware rewrites it here). Direct requests get a 404.
export const dynamic = "force-dynamic";

export default function AdminPage() {
  if (!adminConfig()) notFound();
  return <AdminApp />;
}
