import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth landing. Supabase redirects here with a PKCE code after Google
 * sign-in; exchanging it sets the session cookies, then we send the user on
 * to wherever they were going (always same-origin — `next` is a path only).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
    console.error("[auth/callback] exchange failed:", error.code, error.message);
  } else {
    console.error("[auth/callback] no code in URL:", searchParams.toString());
  }
  return NextResponse.redirect(`${origin}/add?error=signin`);
}
