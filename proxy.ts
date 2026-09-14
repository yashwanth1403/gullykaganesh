import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * Refreshes an expiring Supabase session and writes the new cookies back.
 *
 * Scoped to the routes that need a user. The map page is a cached response
 * and must not pay for an auth round-trip per visitor; anyone tapping
 * "Add yours" lands on /add, where this runs.
 */
export async function proxy(request: NextRequest) {
  const { url, key } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Not for its result — calling it is what triggers the refresh.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/add/:path*", "/auth/:path*", "/p/:path*", "/admin/:path*"],
};
