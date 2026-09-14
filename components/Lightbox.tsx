"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { reportPhoto } from "@/app/actions/report";
import { PHOTO_REPORT_REASONS, type PhotoReportReason } from "@/lib/report-reasons";
import Icon from "./Icon";
import ReportReasons from "./ReportReasons";
import { useSignInPrompt } from "./SignInPrompt";
import type { PandalPhoto } from "@/lib/pandals";

type Props = {
  photos: PandalPhoto[];
  startIndex: number;
  alt: string;
  onClose: () => void;
};

/**
 * Fullscreen photo viewer.
 *
 * The gallery crops to a uniform 4:5 with object-cover; here the image is
 * contained instead, because seeing the whole idol — crown to feet, and the
 * pandal around it — is the entire reason someone taps a photo.
 */
export default function Lightbox({ photos, startIndex, alt, onClose }: Props) {
  const [i, setI] = useState(startIndex);
  // Report state is pinned to the photo it was opened on, so swiping to the
  // next photo reads as closed without an effect resetting anything.
  type ReportState = "closed" | "open" | "sent" | "signin";
  const [reportAt, setReportAt] = useState<{ i: number; state: ReportState }>({ i, state: "closed" });
  const report: ReportState = reportAt.i === i ? reportAt.state : "closed";
  const setReport = (state: ReportState) => setReportAt({ i, state });
  const [pending, startTransition] = useTransition();
  const promptSignIn = useSignInPrompt();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (step: number) => setI((n) => (n + step + photos.length) % photos.length),
    [photos.length],
  );

  function sendReport(reason: PhotoReportReason) {
    startTransition(async () => {
      const r = await reportPhoto({ photoId: photos[i].id, reason });
      if (!r.ok && r.error === "signin") promptSignIn("report this photo");
      setReport(r.ok ? "sent" : r.error === "signin" ? "signin" : "closed");
    });
  }

  useEffect(() => {
    // Remember where focus came from so closing returns the user to the photo
    // they opened, not to the top of the sheet.
    restoreTo.current = document.activeElement as HTMLElement | null;
    // Focus the dialog itself rather than the Close button: focus still moves
    // into the overlay for screen readers and Escape, without opening on a
    // loud focus ring drawn around the first control.
    dialogRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreTo.current?.focus?.();
    };
  }, [go, onClose]);

  // Only ever rendered in response to a click, so document always exists by
  // this point; the guard is belt-and-braces for SSR.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label={`${alt} — photo viewer`}
      className="animate-fade fixed inset-0 z-50 flex flex-col bg-ink/96 backdrop-blur-sm focus:outline-none"
      onClick={onClose}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="flex items-center justify-between px-gutter pt-[max(0.9rem,env(safe-area-inset-top))] pb-2">
        <span className="numeric text-[11px] uppercase tracking-[0.08em] text-paper/70">
          {photos.length > 1 ? `${i + 1} / ${photos.length}` : "Photo"}
        </span>
        <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {report === "closed" && (
            <button
              type="button"
              onClick={() => setReport("open")}
              className="numeric rounded-full px-3 py-2 text-[11px] uppercase tracking-[0.08em] text-paper/70 transition-[transform,background-color,color] duration-150 ease-out hover:bg-paper/10 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric active:scale-95"
            >
              Report
            </button>
          )}
          {report === "sent" && (
            <span className="numeric px-3 text-[11px] uppercase tracking-[0.08em] text-turmeric">
              Thanks, we&apos;ll check it
            </span>
          )}
          {report === "signin" && (
            <button
              type="button"
              onClick={() => promptSignIn("report this photo")}
              className="numeric rounded-full px-3 py-2 text-[11px] uppercase tracking-[0.08em] text-turmeric underline decoration-turmeric/40 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
            >
              Sign in to report
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo"
            className="numeric -mr-1 flex items-center gap-1.5 rounded-full py-2 pr-2.5 pl-3 text-[11px] uppercase tracking-[0.08em] text-paper transition-[transform,background-color] duration-150 ease-out hover:bg-paper/10 active:scale-95"
          >
            Close
            <Icon name="x" size={15} strokeWidth={2.2} />
          </button>
        </span>
      </div>

      {report === "open" && (
        <div className="animate-rise px-gutter pb-3" onClick={(e) => e.stopPropagation()}>
          <ReportReasons
            reasons={PHOTO_REPORT_REASONS}
            onPick={sendReport}
            pending={pending}
            dark
            label="What's wrong with this photo?"
          />
        </div>
      )}

      {/* Stop propagation so tapping the photo itself doesn't dismiss. */}
      <div
        className="relative min-h-0 flex-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          key={photos[i].id}
          src={photos[i].url}
          alt={`${alt}, photo ${i + 1} of ${photos.length}`}
          fill
          sizes="100vw"
          priority
          className="animate-fade object-contain"
        />

        {/* Arrows for pointer users; touch already swipes. */}
        {photos.length > 1 &&
          (
            [
              ["chevronLeft", -1, "Previous photo", "left-3"],
              ["chevronRight", 1, "Next photo", "right-3"],
            ] as const
          ).map(([icon, step, label, side]) => (
            <button
              key={icon}
              type="button"
              onClick={() => go(step)}
              aria-label={label}
              className={`absolute top-1/2 ${side} hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-paper/12 text-paper backdrop-blur-sm transition-[transform,background-color] duration-150 ease-out hover:bg-paper/22 active:scale-95 md:grid`}
            >
              <Icon name={icon} size={20} strokeWidth={2.2} />
            </button>
          ))}
      </div>

      {photos.length > 1 && (
        <div
          className="flex items-center justify-center gap-2 px-gutter pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          {photos.map((photo, n) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setI(n)}
              aria-label={`Show photo ${n + 1}`}
              aria-current={n === i}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out ${
                n === i ? "w-6 bg-turmeric" : "w-1.5 bg-paper/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
