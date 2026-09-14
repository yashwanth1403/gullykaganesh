"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import SignIn from "./SignIn";

type Prompt = {
  /** What the sign-in unlocks, in the viewer's words: "say Morya", "report a photo". */
  reason: string;
};

const Ctx = createContext<(reason: string) => void>(() => {});

/** Opens the sign-in sheet from anywhere under the provider. */
export function useSignInPrompt() {
  return useContext(Ctx);
}

/**
 * Sign in without leaving the map. Anything that needs a user — Morya, a
 * report, an edit — asks here; Google sends the viewer straight back to the
 * URL they were on, pandal open and all.
 */
export function SignInPromptProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const open = useCallback((reason: string) => setPrompt({ reason }), []);
  const close = useCallback(() => setPrompt(null), []);

  return (
    <Ctx.Provider value={open}>
      {children}
      {prompt && <SignInSheet reason={prompt.reason} onClose={close} />}
    </Ctx.Provider>
  );
}

function SignInSheet({ reason, onClose }: { reason: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  // Come back to exactly here — the open pandal is in the URL. The sheet
  // only ever mounts after a tap, so window exists.
  const [next] = useState(() =>
    typeof window === "undefined" ? "/" : window.location.pathname + window.location.search,
  );

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreTo.current?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-ink/55 backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="animate-rise w-full max-w-md rounded-t-[22px] bg-paper px-gutter pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-floating)] focus:outline-none sm:rounded-[22px] sm:pt-5 sm:pb-6"
      >
        {/* Grab handle on phones, where this reads as a sheet. */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no optimiser needed in a portal */}
          <img src="/brand/ganesh-480.webp" alt="" width={56} height={60} className="h-[60px] w-auto shrink-0" />
          <h2 id="signin-title" className="display flex-1 text-[28px] leading-[1.05] text-ink">
            Sign in to {reason}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Not now"
            className="-mr-1.5 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-dim transition-[background-color,transform] duration-150 ease-out hover:bg-paper-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric active:scale-95"
          >
            <Icon name="x" size={16} strokeWidth={2.4} />
          </button>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">
          One tap with Google. You come straight back here, and your name goes on
          what you add.
        </p>
        <div className="mt-5">
          <SignIn next={next} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="numeric mt-3 w-full rounded-full py-2.5 text-[11px] uppercase tracking-[0.08em] text-ink-dim transition-[background-color] duration-150 ease-out hover:bg-paper-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
        >
          Not now
        </button>
      </div>
    </div>,
    document.body,
  );
}
