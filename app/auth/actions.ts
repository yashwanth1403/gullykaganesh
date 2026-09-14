"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side sign-out: clears the session cookies and revokes the refresh
 * token on Supabase, so the session is dead everywhere — not just in this
 * tab. Lands on /add's signed-out state by default so the next person can
 * sign in; the map's avatar menu passes "/" to stay put.
 */
export async function signOut(next: string = "/add") {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/add";
  redirect(safeNext);
}
