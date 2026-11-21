import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { adminPathOrNull } from "@/lib/admin/config";
import { adminHeaders } from "@/lib/admin/headers";

/**
 * Two jobs:
 *  1. Admin panel. The panel lives at /admin-internal, which can't be opened directly (it answers
 *     with the normal 404 page). It is reached only through the secret path from ADMIN_PATH, which
 *     is rewritten internally. Without ADMIN_PATH, the panel doesn't exist at all.
 *  2. Host sessions. Refreshes the Supabase login on the pages that need it.
 */

const SESSION_PATHS = /^\/(host(\/|$)|room\/[A-Z]{4}\/host|auth(\/|$)|login$)/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin-internal" || pathname.startsWith("/admin-internal/")) {
    return NextResponse.rewrite(new URL("/__not-found__", request.url));
  }

  const secret = adminPathOrNull();
  if (secret && (pathname === `/${secret}` || pathname.startsWith(`/${secret}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = `/admin-internal${pathname.slice(secret.length + 1)}`;
    const res = NextResponse.rewrite(url);
    for (const [k, v] of Object.entries(adminHeaders)) res.headers.set(k, v);
    return res;
  }

  return refreshSession(request);
}

async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!SESSION_PATHS.test(request.nextUrl.pathname)) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Refreshes the auth token if it has expired.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Every page and API route, except static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|mp3|wav|ogg|json|txt|xml)$).*)"],
};
