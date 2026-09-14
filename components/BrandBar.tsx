"use client";

import Link from "next/link";

import Icon, { Spinner } from "./Icon";
import ViewerBadge from "./ViewerBadge";
import type { Viewer } from "@/lib/use-viewer";

type Props = {
  festivalDay: number;
  daysToFestival: number;
  pandalCount: number;
  onNearMe: () => void;
  locating: boolean;
  viewer: Viewer | null;
  viewerReady: boolean;
  onSignIn: () => void;
};

export default function BrandBar({
  festivalDay,
  daysToFestival,
  pandalCount,
  onNearMe,
  locating,
  viewer,
  viewerReady,
  onSignIn,
}: Props) {
  const preFestival = daysToFestival > 0;

  return (
    <header className="pointer-events-auto absolute inset-x-0 top-0 z-20">
      {/* Kumkum block — the masthead of a festival banner, not a nav bar. */}
      <div className="bg-kumkum px-gutter pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <h1 className="display text-[26px] text-paper sm:text-[30px]">
            Gully<span className="text-turmeric">Ka</span>Ganesh
          </h1>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/add"
              className="numeric flex items-center gap-1.5 rounded-full bg-turmeric py-2 pr-4 pl-3 text-[11px] uppercase tracking-[0.08em] text-ink shadow-[0_2px_0_rgba(36,18,8,0.22)] transition-transform duration-150 ease-out hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper active:translate-y-px"
            >
              <Icon name="plus" size={15} strokeWidth={2.4} />
              Add yours
            </Link>
            <ViewerBadge viewer={viewer} ready={viewerReady} onSignIn={onSignIn} />
          </div>
        </div>
      </div>

      {/* Turmeric strip — carries the one number that changes daily. */}
      <div className="bg-turmeric px-gutter py-1.5">
        <div className="numeric mx-auto flex max-w-5xl items-center justify-between text-[11px] uppercase tracking-[0.07em] text-ink">
          <span className="flex items-center gap-1.5">
            <Icon name="calendar" size={13} />
            {preFestival ? (
              <>Chaturthi in {daysToFestival}d</>
            ) : (
              <>Day {festivalDay}</>
            )}
          </span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 opacity-70">
              <Icon name="pin" size={13} />
              {pandalCount} mapped
            </span>
            {/* The rankings live off the map; this is the only door to them. */}
            <Link
              href="/top"
              className="flex items-center gap-1 rounded-full bg-ink/10 py-0.5 pr-1.5 pl-2 transition-[background-color,transform] duration-150 ease-out hover:bg-ink/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink active:scale-95"
            >
              Top of the city
              <Icon name="chevronRight" size={12} strokeWidth={2.4} />
            </Link>
          </span>
        </div>
      </div>

      {/* Floats over the map, in the column the zoom control shares. */}
      <div className="px-gutter pt-2.5 md:pl-[398px]">
        <div className="mx-auto flex max-w-5xl justify-end">
          <button
            type="button"
            onClick={onNearMe}
            disabled={locating}
            className="numeric flex items-center gap-1.5 rounded-full border border-line bg-paper/92 py-2 pr-3.5 pl-3 text-[10.5px] uppercase tracking-[0.07em] text-ink shadow-[var(--shadow-floating)] backdrop-blur transition-[transform,background-color] duration-150 ease-out hover:-translate-y-px hover:bg-paper active:translate-y-px disabled:opacity-70"
          >
            {locating ? <Spinner size={13} /> : <Icon name="navigate" size={13} />}
            {locating ? "Finding you…" : "Near me"}
          </button>
        </div>
      </div>
    </header>
  );
}
