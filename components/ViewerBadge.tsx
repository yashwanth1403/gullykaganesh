"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";
import type { Viewer } from "@/lib/use-viewer";
import Icon from "./Icon";

type Props = {
  viewer: Viewer | null;
  ready: boolean;
  onSignIn: () => void;
};

/**
 * The one spot on the map that says who you are. Signed out it's a user
 * glyph that opens the sign-in sheet; signed in it's your Google photo (or
 * initial), and a tap shows your name and the way out. Same footprint both
 * ways so the masthead never shifts.
 */
export default function ViewerBadge({ viewer, ready, onSignIn }: Props) {
  const [menu, setMenu] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const ring =
    "grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full transition-transform duration-150 ease-out hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper active:translate-y-px";

  if (!ready) {
    return <span className={`${ring} bg-paper/15`} aria-hidden />;
  }

  if (!viewer) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        aria-label="Sign in"
        title="Sign in"
        className={`${ring} border border-paper/40 bg-paper/10 text-paper backdrop-blur hover:bg-paper/20`}
      >
        <Icon name="user" size={17} strokeWidth={2.2} />
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setMenu((m) => !m)}
        aria-haspopup="menu"
        aria-expanded={menu}
        aria-label={`Signed in as ${viewer.name}`}
        title={viewer.name}
        className={`${ring} bg-turmeric text-ink shadow-[0_0_0_2px_rgba(250,249,246,0.9)]`}
      >
        {viewer.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Google avatar, off-domain
          <img
            src={viewer.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="display text-[17px] leading-none">{viewer.name.charAt(0).toUpperCase()}</span>
        )}
      </button>

      {menu && (
        <div
          role="menu"
          className="animate-pop absolute right-0 top-[calc(100%+8px)] z-30 w-56 origin-top-right rounded-[14px] border border-line bg-paper p-1.5 shadow-[var(--shadow-floating)]"
        >
          <p className="px-3 pt-2 pb-2.5 text-[13px] leading-snug text-ink">
            <span className="numeric block text-[9.5px] uppercase tracking-[0.07em] text-ink-dim">Signed in as</span>
            <span className="font-semibold">{viewer.name}</span>
          </p>
          <form action={signOut.bind(null, "/")}>
            <button
              type="submit"
              role="menuitem"
              className="numeric flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[11px] uppercase tracking-[0.08em] text-kumkum transition-[background-color] duration-150 ease-out hover:bg-paper-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
            >
              <Icon name="arrowLeft" size={13} />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
