/**
 * Route-level loader for the map page — what shows while the cached page is
 * fetched on a client navigation back to "/". Same masthead as BrandBar and
 * the same curtain MapView draws until its pins land, so the hand-off is
 * invisible: the map simply appears under Bappa.
 */
export default function Loading() {
  return (
    <main className="fixed inset-0 h-dvh w-full overflow-hidden bg-paper">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="bg-kumkum px-gutter pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <span className="display text-[26px] text-paper sm:text-[30px]">
              Gully<span className="text-turmeric">Ka</span>Ganesh
            </span>
            <span className="skeleton h-9 w-28 rounded-full" />
          </div>
        </div>
        <div className="bg-turmeric px-gutter py-1.5">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <span className="skeleton h-3.5 w-24 rounded" />
            <span className="skeleton h-3.5 w-32 rounded" />
          </div>
        </div>
      </header>

      <div
        aria-busy="true"
        aria-label="Loading the map"
        className="absolute inset-0 flex items-center justify-center pb-[236px] md:pb-0 md:pl-[380px]"
      >
        <div className="flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
          <img src="/brand/ganesh-480.webp" alt="" width={132} height={142} className="animate-bob h-[142px] w-auto" />
          <p className="numeric mt-5 text-[11px] uppercase tracking-[0.1em] text-ink-dim">
            Bringing Bappa to the map
          </p>
          <div className="progress-bar relative mt-3 w-36 rounded-full" />
        </div>
      </div>

      {/* The peeked sheet, so the layout doesn't jump when the real one mounts. */}
      <div className="absolute inset-x-0 bottom-0 h-[236px] rounded-t-[22px] bg-paper shadow-[var(--shadow-floating)] md:inset-y-[88px] md:right-auto md:h-auto md:w-[380px] md:rounded-none">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line md:hidden" />
        <div className="px-sheet pt-5">
          <span className="skeleton block h-7 w-40" />
          <span className="skeleton mt-4 block h-6 w-3/4 rounded-full" />
          <span className="skeleton mt-5 block h-12 w-full" />
          <span className="skeleton mt-2 block h-12 w-full" />
        </div>
      </div>
    </main>
  );
}
