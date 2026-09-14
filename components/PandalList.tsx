"use client";

import Image from "next/image";

import Icon from "./Icon";
import {
  distanceKm,
  type Pandal,
  urgencyOf,
  URGENCY_COLOR,
  daysUntilVisarjan,
} from "@/lib/pandals";

type Props = {
  pandals: Pandal[];
  currentDay: number;
  selectedId: string | null;
  /** The viewer's position, when known — rows then show distance from it. */
  origin: { lat: number; lng: number } | null;
  /** "Most loved" mode: rows carry their position. */
  ranked?: boolean;
  /** "Tallest" mode: the height is the point, so it goes first, never truncated. */
  leadWithHeight?: boolean;
  /** Pandal ids this viewer has checked in at — a tick on the row. */
  visited?: Set<string>;
  onSelect: (id: string) => void;
};

function fmtKm(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export default function PandalList({
  pandals,
  currentDay,
  selectedId,
  origin,
  ranked = false,
  leadWithHeight = false,
  visited,
  onSelect,
}: Props) {
  if (pandals.length === 0) {
    return (
      <div className="px-sheet py-10 text-center">
        {/* Bappa himself, when there's no one else to show. */}
        <Image src="/brand/ganesh-480.webp" alt="" width={140} height={150} className="mx-auto h-[150px] w-auto" priority />
        <p className="display mt-3 text-[22px] text-ink">No Ganesh here yet</p>
        <p className="mt-1.5 text-[13px] leading-[1.6] text-ink-dim">
          Be the first to put your gully on the map.
        </p>
      </div>
    );
  }

  return (
    <ul className="px-sheet pb-8">
      {pandals.map((p, i) => {
        const u = urgencyOf(p, currentDay);
        const left = daysUntilVisarjan(p, currentDay);
        const active = p.id === selectedId;
        const color = URGENCY_COLOR[u];

        return (
          <li key={p.id} className="border-b border-line">
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              aria-current={active ? "true" : undefined}
              className={`-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-[14px] px-2 py-2.5 text-left transition-[background-color,transform] duration-150 ease-out hover:bg-paper-warm active:scale-[0.985] ${
                active ? "bg-paper-warm" : ""
              }`}
            >
              {/* The urgency colour backs the thumbnail so the list still
                  reads at a glance while photos load — and stands in as the
                  thumbnail itself for a pandal nobody has photographed yet. */}
              <span
                className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[12px] shadow-[inset_0_0_0_1px_rgba(36,18,8,0.08)]"
                style={{ background: color }}
              >
                {p.photos[0] ? (
                  <Image
                    src={p.photos[0].url}
                    alt=""
                    fill
                    sizes="48px"
                    // The first rows are above the fold in the peeked sheet; one of
                    // their thumbs is usually the page's LCP.
                    loading={i < 3 ? "eager" : undefined}
                    className="object-cover"
                  />
                ) : (
                  <span aria-hidden className="display text-[22px] leading-none text-paper">
                    {p.name.charAt(0)}
                  </span>
                )}
                {/* Rank sits on the thumbnail's corner so the row keeps its
                    shape. Kumkum for the podium, paper for the rest. */}
                {ranked && (
                  <span
                    className={`numeric absolute -top-px -left-px rounded-br-[9px] rounded-tl-[12px] px-1.5 py-[2px] text-[9.5px] leading-none ${
                      i < 3 ? "bg-kumkum text-paper" : "bg-paper text-ink"
                    }`}
                  >
                    {i + 1}
                  </span>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[15px] font-semibold leading-tight text-ink">
                  <span className="truncate">{p.name}</span>
                  {p.ecoFriendly && (
                    <Icon name="leaf" size={12} className="shrink-0 text-leaf" title="Clay idol" />
                  )}
                  {visited?.has(p.id) && (
                    <Icon name="check" size={12} strokeWidth={2.8} className="shrink-0 text-leaf" title="Darshan done" />
                  )}
                </span>
                <span className="mt-1 flex items-center gap-1 truncate text-[12.5px] leading-tight text-ink-dim">
                  <Icon name="pin" size={12} className="shrink-0 opacity-70" />
                  <span className="truncate">
                    {leadWithHeight && (
                      <span className="numeric text-ink">{p.heightFt ? `${p.heightFt} ft` : "height unknown"} · </span>
                    )}
                    {origin && (
                      <span className="numeric text-ink">{fmtKm(distanceKm(origin, p))} · </span>
                    )}
                    {p.gully} · {p.area}
                    {!leadWithHeight && p.heightFt ? ` · ${p.heightFt} ft` : ""}
                  </span>
                </span>
              </span>

              <span className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className="numeric inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[9.5px] uppercase tracking-[0.06em]"
                  style={{
                    color,
                    background: `color-mix(in srgb, ${color} 12%, transparent)`,
                  }}
                >
                  <Icon name={left <= 0 ? "waves" : "clock"} size={11} />
                  {left <= 0 ? "Today" : `${left}d left`}
                </span>
                <span className="numeric flex items-center gap-2 text-[10px] text-ink-dim opacity-80">
                  {p.moryaCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Icon name="modak" size={11} />
                      {p.moryaCount}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Icon name="camera" size={11} />
                    {p.photos.length}
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
