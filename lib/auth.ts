import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "./supabase/server";

export type CurrentUser = { id: string; displayName: string; isAdmin: boolean };

/**
 * The signed-in user, or null. `getUser()` validates the JWT against
 * Supabase rather than trusting the cookie, which is what a Server Action
 * needs before it writes anything.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile] = await db
    .select({ displayName: profiles.displayName, isAdmin: profiles.isAdmin })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  // The signup trigger creates the profile; this only covers a user created
  // before the trigger existed.
  if (!profile) {
    const displayName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Bhakt";
    await db.insert(profiles).values({ id: user.id, displayName }).onConflictDoNothing();
    return { id: user.id, displayName, isAdmin: false };
  }
  return { id: user.id, displayName: profile.displayName, isAdmin: profile.isAdmin };
}
