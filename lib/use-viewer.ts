"use client";

import { useEffect, useState } from "react";
import { createClient } from "./supabase/client";

export type Viewer = { name: string; avatarUrl: string | null };

/**
 * Who is looking, from the browser's own session — no server round-trip, so
 * the cached map page can show "you're signed in" without becoming dynamic.
 * `ready` is false until the first read so nothing flashes signed-out.
 * Not for authorisation: every server action validates the JWT itself.
 */
export function useViewer(): { viewer: Viewer | null; ready: boolean } {
  const [state, setState] = useState<{ viewer: Viewer | null; ready: boolean }>({
    viewer: null,
    ready: false,
  });

  useEffect(() => {
    const supabase = createClient();
    const toViewer = (u: { user_metadata?: Record<string, unknown>; email?: string } | null) =>
      u
        ? {
            name:
              (u.user_metadata?.full_name as string | undefined) ??
              (u.user_metadata?.name as string | undefined) ??
              u.email?.split("@")[0] ??
              "Bhakt",
            avatarUrl:
              (u.user_metadata?.avatar_url as string | undefined) ??
              (u.user_metadata?.picture as string | undefined) ??
              null,
          }
        : null;

    supabase.auth.getSession().then(({ data }) => {
      setState({ viewer: toViewer(data.session?.user ?? null), ready: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ viewer: toViewer(session?.user ?? null), ready: true });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return state;
}
