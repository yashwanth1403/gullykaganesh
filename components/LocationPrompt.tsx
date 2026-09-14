"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

export type LocationPromptMode = "ask" | "denied";

/**
 * Our own words before the browser's dialog. Same sheet as sign-in, so the
 * two "may we?" moments feel like one product. In `denied` mode it can only
 * explain — a site can't re-open a permission the person has blocked.
 */
export default function LocationPrompt({
  mode,
  onAllow,
  onClose,
}: {
  mode: LocationPromptMode;
  onAllow: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

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
        aria-labelledby="location-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="animate-rise w-full max-w-md rounded-t-[22px] bg-paper px-gutter pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-floating)] focus:outline-none sm:rounded-[22px] sm:pt-5 sm:pb-6"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no optimiser needed in a portal */}
          <img src="/brand/ganesh-480.webp" alt="" width={56} height={60} className="h-[60px] w-auto shrink-0" />
          <h2 id="location-title" className="display flex-1 text-[28px] leading-[1.05] text-ink">
            {mode === "ask" ? "Find the Ganesh near you" : "Location is blocked"}
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
          {mode === "ask"
            ? "With your location the list sorts by what's closest, and you can check in when you're standing at a mandapam. It stays on your phone — we never save where you are."
            : "You've blocked location for this site, so the browser won't ask again. To turn it back on, open the site settings from the address bar and allow location, then reload."}
        </p>
        {mode === "ask" ? (
          <>
            <button
              type="button"
              onClick={onAllow}
              className="numeric mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 text-[12px] uppercase tracking-[0.08em] text-paper shadow-[0_2px_0_rgba(36,18,8,0.3)] transition-transform duration-150 ease-out hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric active:translate-y-px"
            >
              <Icon name="navigate" size={15} />
              Use my location
            </button>
            <button
              type="button"
              onClick={onClose}
              className="numeric mt-3 w-full rounded-full py-2.5 text-[11px] uppercase tracking-[0.08em] text-ink-dim transition-[background-color] duration-150 ease-out hover:bg-paper-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
            >
              Not now
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="numeric mt-5 w-full rounded-full border border-line bg-paper py-3 text-[11px] uppercase tracking-[0.08em] text-ink transition-[background-color] duration-150 ease-out hover:bg-paper-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric"
          >
            Got it
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
