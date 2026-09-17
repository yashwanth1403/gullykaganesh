"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getMyMarks, toggleMorya } from "@/app/actions/morya";
import { checkIn } from "@/app/actions/visit";
import { togglePhotoLike } from "@/app/actions/photo-like";
import { createClient } from "@/lib/supabase/client";
import { useSignInPrompt } from "@/components/SignInPrompt";
import { useViewer } from "@/lib/use-viewer";
import MapView from "@/components/MapView";
import BrandBar from "@/components/BrandBar";
import Sheet from "@/components/Sheet";
import PandalList from "@/components/PandalList";
import PandalDetail from "@/components/PandalDetail";
import LocationPrompt, { type LocationPromptMode } from "@/components/LocationPrompt";
import Icon from "@/components/Icon";
import {
  type Pandal,
  FESTIVAL_START,
  HYDERABAD_CENTER,
  distanceKm,
  urgencyOf,
  isStillUp,
  LEGEND,
  type Urgency,
} from "@/lib/pandals";
import { useGeolocation } from "@/lib/use-geolocation";

const DAY_MS = 86_400_000;
/** "New today": put on the map within the last day. */
const NEW_WINDOW_MS = DAY_MS;

function festivalPosition() {
  const now = Date.now();
  const diff = Math.floor((now - FESTIVAL_START.getTime()) / DAY_MS);
  return { day: diff + 1, daysToFestival: Math.max(0, -diff) };
}

// With a fix, the list is simply what's closest — that is the question
// someone standing in a gully is asking. Without one, urgency leads and
// distance from the city centre breaks ties.
function sortNearby(
  list: Pandal[],
  currentDay: number,
  userPos: { lat: number; lng: number } | null,
): Pandal[] {
  if (userPos) {
    return list.sort((a, b) => distanceKm(userPos, a) - distanceKm(userPos, b));
  }
  const origin = { lat: HYDERABAD_CENTER[1], lng: HYDERABAD_CENTER[0] };
  const rank: Record<Urgency, number> = { today: 0, soon: 1, later: 2 };
  return list.sort((a, b) => {
    const byUrgency = rank[urgencyOf(a, currentDay)] - rank[urgencyOf(b, currentDay)];
    if (byUrgency !== 0) return byUrgency;
    return distanceKm(origin, a) - distanceKm(origin, b);
  });
}

export type SortMode = "nearby" | "loved" | "tallest";
/** Why the last Morya tap didn't stick, shown under the button. */
export type MoryaNotice = { id: string; kind: "signin" | "limit" } | null;
/** What happened to the last check-in attempt, shown under its button. */
export type VisitNotice =
  | { id: string; kind: "far"; distanceM: number }
  | { id: string; kind: "done" | "outside" | "nofix" | "signin" }
  | null;

/** A fresh, accurate fix for a check-in — the mount-time one may be stale or coarse. */
function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 15_000 },
    );
  });
}

/** Tallest first; unknown heights last, in their existing order. */
function sortTallest(list: Pandal[]): Pandal[] {
  return list.sort((a, b) => (b.heightFt ?? -1) - (a.heightFt ?? -1));
}

export default function Home({ pandals: cached }: { pandals: Pandal[] }) {
  const { day: realDay, daysToFestival } = useMemo(() => festivalPosition(), []);
  // Before the festival there is no real "day N", so show it as day 1.
  const currentDay = daysToFestival > 0 ? 1 : realDay;

  // /?p=<id> is the share link and the landing after a submission. It seeds
  // the selection; after that the map owns it and the URL follows.
  const linkedId = useSearchParams().get("p");
  const [selectedId, setSelectedId] = useState<string | null>(linkedId);
  const [expanded, setExpanded] = useState(linkedId !== null);
  useEffect(() => {
    const url = selectedId ? `/?p=${selectedId}` : "/";
    if (window.location.pathname + window.location.search !== url) {
      window.history.replaceState(null, "", url);
    }
  }, [selectedId]);

  const { pos: userPos, status: locStatus, locating, locate } = useGeolocation();

  // Our own "may we?" before the browser's. Shown once, unprompted, a beat
  // after the map draws; after that only when someone taps a thing that
  // needs a position. A "Not now" is remembered so it never nags.
  const [locPrompt, setLocPrompt] = useState<LocationPromptMode | null>(null);
  const afterAllow = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (locStatus !== "prompt") return;
    let asked = false;
    try {
      asked = localStorage.getItem("gkg:location-asked") === "1";
    } catch {
      // Private mode or blocked storage — ask, it's still only once per load.
    }
    if (asked) return;
    const t = setTimeout(() => setLocPrompt("ask"), 1500);
    return () => clearTimeout(t);
  }, [locStatus]);

  function rememberAsked() {
    try {
      localStorage.setItem("gkg:location-asked", "1");
    } catch {
      // Nothing to do; we'll ask again next visit.
    }
  }
  function closeLocPrompt() {
    rememberAsked();
    afterAllow.current = null;
    setLocPrompt(null);
  }
  function allowLocation() {
    rememberAsked();
    setLocPrompt(null);
    locate();
    const next = afterAllow.current;
    afterAllow.current = null;
    next?.();
  }
  /** True if a position is available or can be asked for now; opens the sheet otherwise. */
  function ensureLocation(then?: () => void): boolean {
    if (locStatus === "denied") {
      setLocPrompt("denied");
      return false;
    }
    if (locStatus === "prompt" && !userPos) {
      afterAllow.current = then ?? null;
      setLocPrompt("ask");
      return false;
    }
    return true;
  }

  // "Near me" only moves the map; the list already sorts by distance.
  const [nearMeTick, setNearMeTick] = useState(0);
  function nearMe() {
    if (!ensureLocation()) return;
    if (!userPos) locate();
    setNearMeTick((n) => n + 1);
  }
  // The page is cached for everyone, so it carries only the aggregate Morya
  // count. Which ones *this* viewer tapped is fetched after mount — and only
  // when a session cookie exists, so anonymous visitors make no extra request.
  const [myMoryas, setMyMoryas] = useState<Set<string>>(() => new Set());
  const [myVisits, setMyVisits] = useState<Set<string>>(() => new Set());
  const [myLikes, setMyLikes] = useState<Set<string>>(() => new Set());
  const [freshCounts, setFreshCounts] = useState<Map<string, number>>(() => new Map());
  const [freshVisits, setFreshVisits] = useState<Map<string, number>>(() => new Map());
  const [freshLikes, setFreshLikes] = useState<Map<string, number>>(() => new Map());
  const [moryaNotice, setMoryaNotice] = useState<MoryaNotice>(null);
  const [visitNotice, setVisitNotice] = useState<VisitNotice>(null);
  const moryaBusy = useRef<Set<string>>(new Set());
  const visitBusy = useRef<Set<string>>(new Set());
  const likeBusy = useRef<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getSession()
      .then(({ data }) => (data.session ? getMyMarks() : null))
      .then((marks) => {
        if (cancelled || !marks) return;
        if (marks.moryas.length) setMyMoryas(new Set(marks.moryas));
        if (marks.visits.length) setMyVisits(new Set(marks.visits));
        if (marks.likes.length) setMyLikes(new Set(marks.likes));
      })
      .catch(() => {
        // Nothing to recover: the buttons simply show as untapped.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Who's looking, for the badge and for skipping a doomed round-trip.
  const { viewer, ready: viewerReady } = useViewer();
  const promptSignIn = useSignInPrompt();

  async function handleMorya(id: string) {
    if (moryaBusy.current.has(id)) return;
    if (viewerReady && !viewer) {
      promptSignIn("say Morya");
      return;
    }
    moryaBusy.current.add(id);
    const was = myMoryas.has(id);
    const before = freshCounts.get(id) ?? cached.find((p) => p.id === id)?.moryaCount ?? 0;
    // Optimistic: flip now, reconcile with the server's answer below.
    setMyMoryas((s) => {
      const next = new Set(s);
      if (was) next.delete(id);
      else next.add(id);
      return next;
    });
    setFreshCounts((m) => new Map(m).set(id, Math.max(0, before + (was ? -1 : 1))));
    setMoryaNotice(null);
    try {
      const r = await toggleMorya({ pandalId: id });
      if (r.ok) {
        setMyMoryas((s) => {
          const next = new Set(s);
          if (r.said) next.add(id);
          else next.delete(id);
          return next;
        });
        setFreshCounts((m) => new Map(m).set(id, r.count));
      } else {
        setMyMoryas((s) => {
          const next = new Set(s);
          if (was) next.add(id);
          else next.delete(id);
          return next;
        });
        setFreshCounts((m) => new Map(m).set(id, before));
        if (r.error !== "invalid") setMoryaNotice({ id, kind: r.error });
      }
    } finally {
      moryaBusy.current.delete(id);
    }
  }

  // Not optimistic: the server decides whether you were really there, and
  // faking a tick for a second only to take it back would feel like a lie.
  async function handleCheckIn(id: string) {
    if (visitBusy.current.has(id)) return;
    if (viewerReady && !viewer) {
      promptSignIn("check in");
      return;
    }
    if (!ensureLocation(() => handleCheckIn(id))) return;
    visitBusy.current.add(id);
    setVisitNotice(null);
    try {
      const pos = await currentPosition();
      if (!pos) {
        setVisitNotice({ id, kind: "nofix" });
        return;
      }
      const r = await checkIn({ pandalId: id, ...pos });
      if (r.ok) {
        setMyVisits((s) => new Set(s).add(id));
        setFreshVisits((m) => new Map(m).set(id, r.count));
      } else if (r.error === "far") {
        setVisitNotice({ id, kind: "far", distanceM: r.distanceM ?? 0 });
      } else if (r.error === "done") {
        setMyVisits((s) => new Set(s).add(id));
        setVisitNotice({ id, kind: "done" });
      } else if (r.error !== "invalid") {
        setVisitNotice({ id, kind: r.error });
      }
    } finally {
      visitBusy.current.delete(id);
    }
  }

  async function handleLikePhoto(photoId: string, before: number) {
    if (likeBusy.current.has(photoId)) return;
    if (viewerReady && !viewer) {
      promptSignIn("heart a photo");
      return;
    }
    likeBusy.current.add(photoId);
    const was = myLikes.has(photoId);
    const flip = (on: boolean) =>
      setMyLikes((s) => {
        const next = new Set(s);
        if (on) next.add(photoId);
        else next.delete(photoId);
        return next;
      });
    flip(!was);
    setFreshLikes((m) => new Map(m).set(photoId, Math.max(0, before + (was ? -1 : 1))));
    try {
      const r = await togglePhotoLike({ photoId });
      if (r.ok) {
        flip(r.liked);
        setFreshLikes((m) => new Map(m).set(photoId, r.count));
      } else {
        flip(was);
        setFreshLikes((m) => new Map(m).set(photoId, before));
      }
    } finally {
      likeBusy.current.delete(photoId);
    }
  }

  // The cached page plus whatever this viewer changed since it was built.
  // Photo order is left alone here: the cover re-picks itself on the next
  // regeneration, not under the viewer's thumb.
  const pandals = useMemo(() => {
    if (freshCounts.size === 0 && freshVisits.size === 0 && freshLikes.size === 0) return cached;
    return cached.map((p) => {
      const photos = freshLikes.size
        ? p.photos.map((ph) => (freshLikes.has(ph.id) ? { ...ph, likeCount: freshLikes.get(ph.id)! } : ph))
        : p.photos;
      return {
        ...p,
        moryaCount: freshCounts.get(p.id) ?? p.moryaCount,
        visitCount: freshVisits.get(p.id) ?? p.visitCount,
        photos,
      };
    });
  }, [cached, freshCounts, freshVisits, freshLikes]);

  const [sort, setSort] = useState<SortMode>("nearby");
  // Tap a legend chip to see only that tier; tap it again to see everything.
  const [tierFilter, setTierFilter] = useState<Urgency[] | null>(null);
  // Clay idols only — the one attribute filter people actually ask for.
  const [ecoOnly, setEcoOnly] = useState(false);
  // Only what went up in the last day — "what's new since I last looked".
  const [newOnly, setNewOnly] = useState(false);
  // Fixed per mount, so the filter doesn't drift while the sheet is open.
  const [newSince] = useState(() => Date.now() - NEW_WINDOW_MS);

  const live = useMemo(
    () => pandals.filter((p) => isStillUp(p, currentDay)),
    [pandals, currentDay],
  );

  // What the map draws. Order doesn't matter to it, so this is memoised
  // separately from `sorted` — flipping the sort must not rebuild the pins.
  const visible = useMemo(() => {
    let list = live;
    if (tierFilter) list = list.filter((p) => tierFilter.includes(urgencyOf(p, currentDay)));
    if (ecoOnly) list = list.filter((p) => p.ecoFriendly);
    if (newOnly) list = list.filter((p) => p.addedAt >= newSince);
    return list;
  }, [live, currentDay, tierFilter, ecoOnly, newOnly, newSince]);

  const sorted = useMemo(() => {
    const list = sortNearby([...visible], currentDay, userPos);
    // Array.sort is stable, so ties keep the nearby/urgency order.
    if (sort === "loved") return list.sort((a, b) => b.moryaCount - a.moryaCount);
    if (sort === "tallest") return sortTallest(list);
    return list;
  }, [visible, currentDay, userPos, sort]);

  // Detail must resolve even when a filter hides the row — a share link to a
  // filtered-out pandal should still open it.
  const selected = live.find((p) => p.id === selectedId) ?? null;

  function handleSelect(id: string) {
    setSelectedId(id);
    setExpanded(true);
  }

  // Chip counts describe the whole live set, not the filtered view, so the
  // numbers don't collapse to zero the moment you filter.
  const counts = useMemo(() => {
    const c: Record<Urgency, number> = { today: 0, soon: 0, later: 0 };
    live.forEach((p) => (c[urgencyOf(p, currentDay)] += 1));
    return c;
  }, [live, currentDay]);
  const ecoCount = useMemo(() => live.filter((p) => p.ecoFriendly).length, [live]);
  const newCount = useMemo(() => live.filter((p) => p.addedAt >= newSince).length, [live, newSince]);

  return (
    <main className="fixed inset-0 h-dvh w-full overflow-hidden bg-paper">
      {/* The map draws nothing a crawler can read. This paragraph is what
          the home page *says*, for search engines and screen readers alike. */}
      <p className="sr-only">
        GullyKaGanesh (Gully Ka Ganesh, also searched as Galli Ka Ganesh) is
        Hyderabad&apos;s crowdsourced map of unique Ganesh pandals and mandapams for Ganesh
        Chaturthi 2026. Browse creative Ganesh idol themes across the
        city, find the ones near you, plan your darshan route before visarjan, and add your
        gully&apos;s Ganesh so the whole city can find it.
      </p>
      <MapView
        pandals={visible}
        currentDay={currentDay}
        selectedId={selectedId}
        userPos={userPos}
        nearMeTick={nearMeTick}
        onSelect={handleSelect}
        onDeselect={() => setSelectedId(null)}
      />

      <BrandBar
        festivalDay={currentDay}
        daysToFestival={daysToFestival}
        pandalCount={live.length}
        onNearMe={nearMe}
        locating={locating}
        viewer={viewer}
        viewerReady={viewerReady}
        onSignIn={() => promptSignIn("GullyKaGanesh")}
      />

      <Sheet expanded={expanded} onExpandedChange={setExpanded}>
        {selected ? (
          <PandalDetail
            pandal={selected}
            currentDay={currentDay}
            said={myMoryas.has(selected.id)}
            notice={moryaNotice?.id === selected.id ? moryaNotice.kind : null}
            onMorya={() => handleMorya(selected.id)}
            visited={myVisits.has(selected.id)}
            visitNotice={visitNotice?.id === selected.id ? visitNotice : null}
            onCheckIn={() => handleCheckIn(selected.id)}
            myLikes={myLikes}
            onLikePhoto={handleLikePhoto}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <>
            <div className="px-sheet pb-2.5">
              <div className="flex items-end justify-between gap-3">
                <h2 className="display text-[23px] leading-none text-ink">
                  {sort === "loved"
                    ? "Most loved"
                    : sort === "tallest"
                      ? "Tallest"
                      : userPos
                        ? "Near you"
                        : "Leaving soonest"}
                </h2>
                {/* Two ways to read the same list. The whole thing is one
                    control, so it reads as a switch rather than two buttons. */}
                <div
                  role="radiogroup"
                  aria-label="Sort by"
                  className="numeric mb-0.5 flex shrink-0 rounded-full border border-line bg-paper p-[2px] text-[9.5px] uppercase tracking-[0.06em]"
                >
                  {(
                    [
                      ["nearby", userPos ? "Near" : "Soonest", "navigate"],
                      ["loved", "Loved", "modak"],
                      ["tallest", "Tallest", "ruler"],
                    ] as const
                  ).map(([mode, label, icon]) => {
                    const on = sort === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setSort(mode)}
                        className={`flex items-center gap-1 rounded-full px-2 py-1 transition-[background-color,color,transform] duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-turmeric active:scale-[0.97] ${
                          on ? "bg-ink text-paper" : "text-ink-dim hover:text-ink"
                        }`}
                      >
                        <Icon name={icon} size={11} className={on ? "" : "opacity-70"} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legend doubles as the count and the filter — it says what
                  the colours mean, how many there are, and tapping one shows
                  only that tier. */}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {LEGEND.map((row) => {
                  const on = tierFilter === row.tiers;
                  return (
                    <button
                      key={row.label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTierFilter(on ? null : row.tiers)}
                      className="flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-2 transition-[background-color,border-color,transform] duration-150 ease-out hover:bg-paper-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-turmeric active:scale-[0.97]"
                      style={
                        on
                          ? {
                              borderColor: row.color,
                              background: `color-mix(in srgb, ${row.color} 12%, transparent)`,
                            }
                          : { borderColor: "var(--color-line)", background: "var(--color-paper)" }
                      }
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{ background: row.color }}
                      />
                      <span
                        className={`numeric text-[9.5px] uppercase tracking-[0.05em] ${on ? "text-ink" : "text-ink-dim"}`}
                      >
                        {row.label}
                      </span>
                      <span
                        className="numeric text-[9.5px]"
                        style={{ color: row.color }}
                      >
                        {row.tiers.reduce((n, t) => n + counts[t], 0)}
                      </span>
                    </button>
                  );
                })}
                {/* Same chip grammar; leaf is the palette's colour for "checked
                    and good", which is what a clay idol is. */}
                <button
                  type="button"
                  aria-pressed={ecoOnly}
                  onClick={() => setEcoOnly((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-2 transition-[background-color,border-color,transform] duration-150 ease-out hover:bg-paper-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-turmeric active:scale-[0.97]"
                  style={
                    ecoOnly
                      ? { borderColor: "var(--color-leaf)", background: "color-mix(in srgb, var(--color-leaf) 12%, transparent)" }
                      : { borderColor: "var(--color-line)", background: "var(--color-paper)" }
                  }
                >
                  <Icon name="leaf" size={10} className="text-leaf" />
                  <span className={`numeric text-[9.5px] uppercase tracking-[0.05em] ${ecoOnly ? "text-ink" : "text-ink-dim"}`}>
                    Clay idols
                  </span>
                  <span className="numeric text-[9.5px] text-leaf">{ecoCount}</span>
                </button>
                {/* Turmeric, the colour of the "Add yours" button: this chip
                    is where those additions show up. */}
                <button
                  type="button"
                  aria-pressed={newOnly}
                  onClick={() => setNewOnly((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-2 transition-[background-color,border-color,transform] duration-150 ease-out hover:bg-paper-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-turmeric active:scale-[0.97]"
                  style={
                    newOnly
                      ? { borderColor: "var(--color-turmeric)", background: "color-mix(in srgb, var(--color-turmeric) 16%, transparent)" }
                      : { borderColor: "var(--color-line)", background: "var(--color-paper)" }
                  }
                >
                  <Icon name="sparkle" size={10} className="text-turmeric" />
                  <span className={`numeric text-[9.5px] uppercase tracking-[0.05em] ${newOnly ? "text-ink" : "text-ink-dim"}`}>
                    New today
                  </span>
                  <span className="numeric text-[9.5px] text-turmeric">{newCount}</span>
                </button>
              </div>
            </div>

            <PandalList
              pandals={sorted}
              currentDay={currentDay}
              selectedId={selectedId}
              origin={userPos}
              ranked={sort !== "nearby"}
              leadWithHeight={sort === "tallest"}
              visited={myVisits}
              onSelect={handleSelect}
            />
          </>
        )}
      </Sheet>
      {locPrompt && (
        <LocationPrompt mode={locPrompt} onAllow={allowLocation} onClose={closeLocPrompt} />
      )}
    </main>
  );
}
