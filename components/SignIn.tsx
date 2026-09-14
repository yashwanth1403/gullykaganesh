"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "./Icon";

/**
 * Google is the only provider: everyone in the city with a phone has an
 * account, and one tap is the most friction a festival-week upload can bear.
 */
export default function SignIn({ next = "/add" }: { next?: string }) {
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={busy}
      className="numeric flex w-full items-center justify-center gap-2.5 rounded-full bg-ink py-3.5 text-[12px] uppercase tracking-[0.08em] text-paper shadow-[0_2px_0_rgba(36,18,8,0.3)] transition-transform duration-150 ease-out hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric active:translate-y-px disabled:opacity-60"
    >
      {busy ? (
        <Spinner size={16} />
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#FAF9F6"
            d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z"
          />
          <path
            fill="#F2A93C"
            d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
          />
          <path
            fill="#D6402C"
            d="M6.4 14a6 6 0 0 1 0-3.9V7.4H3.1a10 10 0 0 0 0 9.1L6.4 14Z"
          />
          <path
            fill="#FAF9F6"
            d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.4l3.3 2.6C7.2 7.8 9.4 6 12 6Z"
          />
        </svg>
      )}
      {busy ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}
