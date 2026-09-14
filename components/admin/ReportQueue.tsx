"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dismissReports, revokeClaim, setPandalStatus, setPhotoStatus } from "@/app/admin/actions";
import type { ContentStatus, ReportTarget } from "@/lib/admin-queries";
import Icon, { Spinner } from "../Icon";

const STATUS_STYLE: Record<ContentStatus, string> = {
  live: "bg-leaf text-paper",
  hidden: "bg-kumkum text-paper",
  removed: "bg-ink/10 text-ink-dim",
};

const btn =
  "numeric rounded-full border px-3 py-1.5 text-[10.5px] uppercase tracking-[0.07em] transition-[background-color,transform] duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-turmeric active:scale-[0.97] disabled:opacity-50";
const quiet = `${btn} border-line bg-paper text-ink hover:bg-paper-warm`;
const loud = `${btn} border-kumkum/50 bg-paper text-kumkum hover:bg-kumkum/8`;

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/** One target — a pandal or a photo — with what's been said and what to do. */
function TargetCard({ t }: { t: ReportTarget }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function run(action: () => Promise<void>) {
    setFailed(false);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch {
        setFailed(true);
      }
    });
  }
  const setStatus = (s: ContentStatus) =>
    run(() => (t.kind === "pandal" ? setPandalStatus(t.id, s) : setPhotoStatus(t.id, s)));
  const dismiss = () =>
    run(() => dismissReports(t.kind === "pandal" ? { pandalId: t.id } : { photoId: t.id }));

  return (
    <li className="rounded-xl border border-line bg-paper p-3.5 shadow-[var(--shadow-elevated)]" aria-busy={pending}>
      <div className="flex gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[12px] bg-paper-warm">
          {t.thumb ? (
            <Image src={t.thumb} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-ink-dim">
              <Icon name={t.kind === "photo" ? "image" : "pin"} size={20} />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="display truncate text-[19px] leading-tight text-ink">{t.title}</h3>
            <span className={`numeric shrink-0 rounded-full px-2 py-0.5 text-[9.5px] uppercase tracking-[0.07em] ${STATUS_STYLE[t.status]}`}>
              {t.status}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-ink-dim">{t.subtitle}</p>
          <p className="mt-1 text-[11.5px] text-ink-dim">
            {t.addedBy ? `Added by ${t.addedBy}` : "Seeded landmark"}
            {t.claimedBy && ` · Run by ${t.claimedBy}`}
          </p>
        </div>
      </div>

      {t.reasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {t.reasons.map((r) => (
            <span key={r.label} className="rounded-full bg-turmeric/18 px-2.5 py-1 text-[12px] text-ink">
              {r.label}
              {r.count > 1 && <span className="numeric ml-1 text-ink-dim">×{r.count}</span>}
            </span>
          ))}
        </div>
      )}
      {t.reporters.length > 0 && (
        <p className="mt-2 text-[11.5px] text-ink-dim">
          Reported by {t.reporters.join(", ")} · latest {when(t.at)}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {t.status === "live" && (
          <>
            {t.reasons.length > 0 && (
              <button type="button" disabled={pending} onClick={dismiss} className={quiet}>
                Nothing wrong
              </button>
            )}
            <button type="button" disabled={pending} onClick={() => setStatus("hidden")} className={quiet}>
              Hide
            </button>
          </>
        )}
        {t.status === "hidden" && (
          <button type="button" disabled={pending} onClick={() => setStatus("live")} className={quiet}>
            Bring back
          </button>
        )}
        {t.status !== "removed" && (
          <button type="button" disabled={pending} onClick={() => setStatus("removed")} className={loud}>
            Remove for good
          </button>
        )}
        {t.kind === "pandal" && t.claimedBy && (
          <button type="button" disabled={pending} onClick={() => run(() => revokeClaim(t.id))} className={loud}>
            Revoke claim
          </button>
        )}
        <Link
          href={`/?p=${t.pandalId}`}
          className="numeric ml-auto flex items-center gap-1 rounded-full px-2 py-1.5 text-[10.5px] uppercase tracking-[0.07em] text-ink-dim underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric"
        >
          On the map
          <Icon name="chevronRight" size={12} />
        </Link>
        {pending && <Spinner size={14} />}
      </div>
      {failed && (
        <p role="alert" className="mt-2 text-[12px] text-kumkum">
          That didn&apos;t apply. Refresh and try again.
        </p>
      )}
    </li>
  );
}

export default function ReportQueue({ open, hidden }: { open: ReportTarget[]; hidden: ReportTarget[] }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="display text-[24px] text-ink">
          Needs a look
          <span className="numeric ml-2 align-middle text-[13px] text-ink-dim">{open.length}</span>
        </h2>
        {open.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13.5px] text-ink-dim">
            No open reports. Go see some Ganeshas.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {open.map((t) => (
              <TargetCard key={`${t.kind}:${t.id}`} t={t} />
            ))}
          </ul>
        )}
      </section>

      {hidden.length > 0 && (
        <section>
          <h2 className="display text-[24px] text-ink">
            Hidden, no open reports
            <span className="numeric ml-2 align-middle text-[13px] text-ink-dim">{hidden.length}</span>
          </h2>
          <p className="mt-1 text-[13px] text-ink-dim">Off the map until you bring them back.</p>
          <ul className="mt-3 space-y-3">
            {hidden.map((t) => (
              <TargetCard key={`${t.kind}:${t.id}`} t={t} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
