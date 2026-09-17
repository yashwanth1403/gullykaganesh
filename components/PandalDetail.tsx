"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import Link from "next/link";
import { reportPandal } from "@/app/actions/report";
import { REPORT_REASONS, type ReportReason } from "@/lib/report-reasons";
import Icon from "./Icon";
import Lightbox from "./Lightbox";
import ReportReasons from "./ReportReasons";
import { useSignInPrompt } from "./SignInPrompt";
import type { VisitNotice } from "./Home";
import {
  type Pandal,
  annadhanamLabel,
  todayIST,
  urgencyOf,
  URGENCY_COLOR,
  daysUntilVisarjan,
  visarjanDate,
} from "@/lib/pandals";

type Props = {
  pandal: Pandal;
  currentDay: number;
  /** Whether this viewer has said Morya here. */
  said: boolean;
  /** Why the last tap didn't count, if it didn't. */
  notice: "signin" | "limit" | null;
  onMorya: () => void;
  /** Whether this viewer has checked in here on any day. */
  visited: boolean;
  visitNotice: VisitNotice;
  onCheckIn: () => void;
  /** Photo ids this viewer has hearted. */
  myLikes: Set<string>;
  onLikePhoto: (photoId: string, currentCount: number) => void;
  onBack: () => void;
};

function moryaLabel(n: number) {
  return `${n} ${n === 1 ? "morya" : "moryas"}`;
}

function darshanLabel(n: number) {
  return n === 0 ? "No darshans yet" : `${n} ${n === 1 ? "darshan" : "darshans"}`;
}

function visitNoticeText(n: NonNullable<VisitNotice>): string {
  switch (n.kind) {
    case "far":
      return n.distanceM >= 1000
        ? `You're ${(n.distanceM / 1000).toFixed(1)} km away — check in from the mandapam`
        : `You're ${n.distanceM} m away — get within 300 m`;
    case "done":
      return "Already counted for today";
    case "outside":
      return "Check-ins open on Chaturthi";
    case "nofix":
      return "Couldn't get your location — allow it and try again";
    case "signin":
      return "Sign in to check in";
  }
}

export default function PandalDetail({
  pandal,
  currentDay,
  said,
  notice,
  onMorya,
  visited,
  visitNotice,
  onCheckIn,
  myLikes,
  onLikePhoto,
  onBack,
}: Props) {
  const [lightboxAt, setLightboxAt] = useState<number | null>(null);
  const [shared, setShared] = useState(false);
  const [report, setReport] = useState<"closed" | "open" | "sent" | "signin">("closed");
  const [pending, startTransition] = useTransition();
  const promptSignIn = useSignInPrompt();

  function sendReport(reason: ReportReason) {
    startTransition(async () => {
      const r = await reportPandal({ pandalId: pandal.id, reason });
      if (!r.ok && r.error === "signin") promptSignIn("report this");
      setReport(r.ok ? "sent" : r.error === "signin" ? "signin" : "closed");
    });
  }

  // The native share sheet where it exists (every phone); the clipboard
  // elsewhere. The link is the product's whole growth loop.
  async function share() {
    const url = `${window.location.origin}/?p=${pandal.id}`;
    const text = `${pandal.name}, ${pandal.area} — visarjan ${visarjanDate(pandal)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: pandal.name, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    } catch {
      // User dismissed the share sheet — nothing to report.
    }
  }
  const u = urgencyOf(pandal, currentDay);
  const left = daysUntilVisarjan(pandal, currentDay);
  // "False claim" only means something once there is a claim to dispute.
  const reportReasons = pandal.claimedBy
    ? REPORT_REASONS
    : (Object.fromEntries(
        Object.entries(REPORT_REASONS).filter(([k]) => k !== "false_claim"),
      ) as Record<ReportReason, string>);

  return (
    <div className="animate-rise pb-10">
      <div className="px-sheet">
        <button
          type="button"
          onClick={onBack}
          className="numeric mb-3 -ml-1 flex items-center gap-1 rounded-full py-1 pr-2 pl-1 text-[11px] uppercase tracking-[0.07em] text-ink-dim transition-[transform,background-color] duration-150 ease-out hover:-translate-x-0.5 hover:bg-paper-warm active:scale-95"
        >
          <Icon name="arrowLeft" size={15} />
          All mandapams
        </button>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="display text-[27px] leading-[1.05] text-ink">
              {pandal.name}
            </h2>
            <p className="mt-1.5 flex items-center gap-1 text-[13px] leading-[1.6] text-ink-dim">
              <Icon name="pin" size={13} className="shrink-0 opacity-70" />
              {pandal.gully} · {pandal.area}
            </p>
            {/* Up here with the name, not down with the credits: for many
                mandapams the Instagram page is the real front door. */}
            {pandal.instagramHandle && (
              <a
                href={`https://instagram.com/${pandal.instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 rounded-sm text-[13px] leading-[1.6] text-kumkum underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
              >
                <Icon name="instagram" size={13} />
                {pandal.instagramHandle}
              </a>
            )}
          </div>
          {pandal.verified && (
            <span className="numeric flex shrink-0 items-center gap-1 rounded-full bg-leaf py-1 pr-2.5 pl-1.5 text-[9.5px] uppercase tracking-[0.07em] text-paper">
              <Icon name="check" size={12} strokeWidth={2.6} />
              Verified
            </span>
          )}
        </div>

        {/* Urgency stated in words, not just colour — colour alone fails for
            anyone who can't distinguish these three hues. */}
        <div
          className="mt-3.5 flex items-center justify-between rounded-[12px] px-3.5 py-2.5 text-paper shadow-[var(--shadow-elevated)]"
          style={{ background: URGENCY_COLOR[u] }}
        >
          <span className="numeric flex items-center gap-2 text-[11px] uppercase tracking-[0.07em]">
            <Icon name={left <= 0 ? "waves" : "clock"} size={15} />
            {left <= 0 ? "Immersed today" : `${left} days left`}
          </span>
          <span className="numeric flex items-center gap-1.5 text-[13px]">
            <Icon name="calendar" size={13} className="opacity-80" />
            {visarjanDate(pandal)}
          </span>
        </div>

        {/* The things that make this one *this* one. Only what's known; an
            empty row would be worse than none. */}
        {/* Annadhanam gets its own block, not a chip: for a lot of people
            it is the reason to go to *this* mandapam today. Turmeric, the
            palette's "good news" colour, on paper so it sits under the
            urgency banner rather than competing with it. */}
        {pandal.annadhanamDate && (
          <div className="mt-2.5 flex items-center justify-between rounded-[12px] border border-turmeric/50 bg-turmeric/12 px-3.5 py-2.5">
            <span className="numeric flex items-center gap-2 text-[11px] uppercase tracking-[0.07em] text-ink">
              <Icon name="rice" size={15} />
              Annadhanam{pandal.annadhanamDate === todayIST() ? " today" : ""}
            </span>
            <span className="numeric flex items-center gap-1.5 text-[13px] text-ink">
              <Icon name="calendar" size={13} className="opacity-70" />
              {annadhanamLabel(pandal.annadhanamDate)}
            </span>
          </div>
        )}

        {(pandal.theme || pandal.establishedYear || pandal.ecoFriendly) && (
          <ul className="mt-3 flex flex-wrap gap-1.5 text-[12.5px] text-ink">
            {pandal.theme && (
              <li className="flex items-center gap-1.5 rounded-full border border-line bg-paper py-1 pr-2.5 pl-2">
                <Icon name="sparkle" size={12} className="text-turmeric" />
                {pandal.theme}
              </li>
            )}
            {pandal.establishedYear && (
              <li className="flex items-center gap-1.5 rounded-full border border-line bg-paper py-1 pr-2.5 pl-2">
                <Icon name="calendar" size={12} className="opacity-70" />
                Since {pandal.establishedYear}
              </li>
            )}
            {pandal.ecoFriendly && (
              <li className="flex items-center gap-1.5 rounded-full border border-leaf/40 bg-leaf/8 py-1 pr-2.5 pl-2 text-leaf">
                <Icon name="leaf" size={12} />
                Clay idol
              </li>
            )}
          </ul>
        )}

        {pandal.description && (
          <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-ink">{pandal.description}</p>
        )}
      </div>

      <div // scroll-px matches the padding: without it snap alignment scrolls the
        // container by exactly the padding amount and the first photo sits
        // flush against the edge.
        className="mt-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-sheet scroll-px-sheet pb-1">
        {pandal.photos.length === 0 && (
          <p className="flex aspect-[4/5] w-[57%] shrink-0 items-center justify-center rounded-xl border border-dashed border-line px-5 text-center text-[13px] leading-snug text-ink-dim">
            No photos yet. Be the first to add one.
          </p>
        )}
        {pandal.photos.map((photo, i) => {
          const liked = myLikes.has(photo.id);
          return (
            <div key={photo.id} className="relative aspect-[4/5] w-[57%] shrink-0 snap-start">
              <button
                type="button"
                onClick={() => setLightboxAt(i)}
                aria-label={`${photo.video ? "Play video" : "Open photo"} ${i + 1} of ${pandal.photos.length} full screen`}
                className="absolute inset-0 overflow-hidden rounded-xl bg-paper-warm shadow-[var(--shadow-elevated)] transition-transform duration-150 ease-out active:scale-[0.98]"
              >
                <Image
                  src={photo.url}
                  alt={`${pandal.name}, photo ${i + 1}`}
                  fill
                  sizes="(max-width: 640px) 57vw, 220px"
                  priority={i === 0}
                  loading={i === 0 ? "eager" : undefined}
                  className="object-cover"
                />
                {/* Depth treatment so photos sit under the type, not fight it. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
                {/* A video shows its poster here; the file only loads in the lightbox. */}
                {photo.video && (
                  <span className="numeric absolute top-2 left-2 flex items-center gap-1 rounded-full bg-ink/70 py-1 pr-2 pl-1.5 text-[10px] tracking-[0.04em] text-paper backdrop-blur">
                    <Icon name="play" size={10} strokeWidth={2.4} className="fill-current" />
                    {Math.floor(photo.video.durationS / 60)}:{String(photo.video.durationS % 60).padStart(2, "0")}
                  </span>
                )}
              </button>
              {/* A sibling, not a child, of the photo button — nested buttons
                  aren't allowed, and the heart must not open the lightbox. */}
              <button
                type="button"
                onClick={() => onLikePhoto(photo.id, photo.likeCount)}
                aria-pressed={liked}
                aria-label={liked ? "Remove your heart" : "Heart this photo"}
                className={`numeric absolute right-2 bottom-2 flex items-center gap-1 rounded-full py-1 pr-2 pl-1.5 text-[11px] shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-[transform,background-color,color] duration-150 ease-out hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-turmeric active:scale-95 ${
                  liked ? "bg-rani text-paper" : "bg-paper/90 text-ink"
                }`}
              >
                <Icon name="heart" size={12} className={liked ? "fill-current" : ""} strokeWidth={2.2} />
                {photo.likeCount}
              </button>
            </div>
          );
        })}
      </div>

      {/* The one thing you can *do* here besides go. Filled once you've said
          it, so the state reads at a glance; the count sits right under it
          so it's clear what the tap changes. */}
      <div className="mx-sheet mt-4">
        <button
          type="button"
          onClick={onMorya}
          aria-pressed={said}
          className={`numeric flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[12px] uppercase tracking-[0.08em] transition-[transform,background-color,color] duration-150 ease-out hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric active:translate-y-px ${
            said
              ? "bg-kumkum text-paper shadow-[0_2px_0_rgba(36,18,8,0.3)]"
              : "border border-line bg-paper text-ink hover:bg-paper-warm"
          }`}
        >
          <Icon name="modak" size={15} className={said ? "text-turmeric" : ""} />
          {said ? "Morya said!" : "Ganpati Bappa Morya"}
        </button>
        <p
          key={notice ?? pandal.moryaCount}
          className="animate-pop numeric mt-1.5 text-center text-[10px] uppercase tracking-[0.06em] text-ink-dim"
        >
          {notice === "signin" ? (
            <button
              type="button"
              onClick={() => promptSignIn("say Morya")}
              className="rounded-sm text-kumkum underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
            >
              Sign in to say Morya
            </button>
          ) : notice === "limit" ? (
            "Bas — that's plenty for one hour"
          ) : (
            `${moryaLabel(pandal.moryaCount)} · ${darshanLabel(pandal.visitCount)}`
          )}
        </p>

        {/* Check-in is deliberately not optimistic — the server decides if
            you were really there. Leaf once it has said yes. */}
        <button
          type="button"
          onClick={onCheckIn}
          aria-pressed={visited}
          className={`numeric mt-2.5 flex w-full items-center justify-center gap-2 rounded-full py-3 text-[11px] uppercase tracking-[0.08em] transition-[transform,background-color,color] duration-150 ease-out hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric active:translate-y-px ${
            visited
              ? "bg-leaf text-paper shadow-[0_2px_0_rgba(36,18,8,0.3)]"
              : "border border-line bg-paper text-ink hover:bg-paper-warm"
          }`}
        >
          <Icon name={visited ? "check" : "pin"} size={14} strokeWidth={visited ? 2.6 : 1.9} />
          {visited ? "Darshan done" : "I'm here — darshan done"}
        </button>
        {visitNotice && (
          <p
            key={visitNotice.kind}
            className="animate-pop numeric mt-1.5 text-center text-[10px] uppercase tracking-[0.06em] text-ink-dim"
          >
            {visitNotice.kind === "signin" ? (
              <button
                type="button"
                onClick={() => promptSignIn("check in")}
                className="rounded-sm text-kumkum underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
              >
                Sign in to check in
              </button>
            ) : (
              visitNoticeText(visitNotice)
            )}
          </p>
        )}
      </div>

      <dl className="mx-sheet mt-3.5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {(
          [
            [
              "ruler",
              "Height",
              pandal.heightFt ? `${pandal.heightFt} ft` : "—",
              // Self-reported until an admin has seen it. Say which.
              pandal.heightFt ? (pandal.heightVerified ? "verified" : "claimed") : null,
            ],
            ["waves", "Visarjan", `Day ${pandal.visarjanDay}`, null],
            ["camera", "Photos", String(pandal.photos.length), null],
          ] as const
        ).map(([icon, label, value, sub]) => (
          <div key={label} className="bg-paper px-3 py-3 text-center">
            <dt className="numeric flex items-center justify-center gap-1 text-[9.5px] uppercase tracking-[0.07em] text-ink-dim">
              <Icon name={icon} size={12} />
              {label}
            </dt>
            <dd className="numeric mt-1 text-[17px] leading-tight text-ink">
              {value}
              {sub && (
                <span
                  className={`mt-0.5 block text-[8.5px] uppercase tracking-[0.06em] ${sub === "verified" ? "text-leaf" : "text-ink-dim"}`}
                >
                  {sub}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mx-sheet mt-4 flex gap-2.5">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${pandal.lat},${pandal.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="numeric flex flex-1 items-center justify-center gap-1.5 rounded-full bg-turmeric py-3 text-[11px] uppercase tracking-[0.08em] text-ink shadow-[0_2px_0_rgba(36,18,8,0.18)] transition-transform duration-150 ease-out hover:-translate-y-px active:translate-y-px"
        >
          <Icon name="navigate" size={14} />
          Directions
        </a>
        <button
          type="button"
          onClick={share}
          className="numeric flex flex-1 items-center justify-center gap-1.5 rounded-full border border-line bg-paper py-3 text-[11px] uppercase tracking-[0.08em] text-ink transition-[transform,background-color] duration-150 ease-out hover:-translate-y-px hover:bg-paper-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric active:translate-y-px"
        >
          <Icon name={shared ? "check" : "share"} size={14} />
          {shared ? "Link copied" : "Share"}
        </button>
      </div>


      <div className="px-sheet mt-3.5 flex items-start justify-between gap-3 text-[11.5px] text-ink-dim">
        <p className="flex min-w-0 items-start gap-1.5">
          <Icon name="user" size={12} className="mt-0.5 shrink-0 opacity-70" />
          <span>
            {pandal.addedBy ? `Added by ${pandal.addedBy}` : "A well-known city mandapam"}
            {pandal.claimedBy && ` · Run by ${pandal.claimedBy}`}
          </span>
        </p>
        <span className="flex shrink-0 items-center gap-3">
          {/* Every card gets the same door; the page behind it decides
              whether you edit, claim, or sign in first. */}
          <Link
            href={`/p/${pandal.id}/manage`}
            className="rounded-sm underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
          >
            Edit or claim
          </Link>
          {report === "closed" && (
            <button
              type="button"
              onClick={() => setReport("open")}
              className="rounded-sm underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
            >
              Something wrong?
            </button>
          )}
          {report === "sent" && <span className="text-leaf">Thanks, we&apos;ll check it</span>}
          {report === "signin" && (
            <button
              type="button"
              onClick={() => promptSignIn("report this")}
              className="rounded-sm text-kumkum underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
            >
              Sign in to report
            </button>
          )}
        </span>
      </div>

      {report === "open" && (
        <div className="mx-sheet mt-2.5">
          <ReportReasons reasons={reportReasons} onPick={sendReport} pending={pending} />
        </div>
      )}

      {lightboxAt !== null && (
        <Lightbox
          photos={pandal.photos}
          startIndex={lightboxAt}
          alt={pandal.name}
          onClose={() => setLightboxAt(null)}
        />
      )}
    </div>
  );
}
