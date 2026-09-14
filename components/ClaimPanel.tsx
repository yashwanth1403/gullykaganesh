"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { claimPandal } from "@/app/p/[id]/actions";
import Icon, { Spinner } from "./Icon";

type Props = {
  pandalId: string;
  /** Display name of whoever already claimed it, if anyone. */
  claimedByName: string | null;
};

/**
 * What a signed-in viewer who doesn't own the pandal sees on the manage
 * page. Unclaimed: one button. Already claimed: who, and the way to dispute
 * it — the report chips on the card carry a "false claim" reason.
 */
export default function ClaimPanel({ pandalId, claimedByName }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function claim() {
    setError(null);
    startTransition(async () => {
      const r = await claimPandal(pandalId);
      if (r.ok) {
        // The page re-renders as the edit form: the server now sees you as owner.
        router.refresh();
        return;
      }
      setError(
        r.error === "claimed"
          ? "Someone claimed it just before you. Refresh to see who."
          : r.error === "signin"
            ? "Your session ended. Sign in again."
            : "That didn't go through. Try again.",
      );
    });
  }

  if (claimedByName) {
    return (
      <div className="rounded-xl border border-line bg-paper-warm px-4 py-4">
        <p className="flex items-center gap-2 text-[15px] text-ink">
          <Icon name="user" size={15} className="shrink-0 opacity-70" />
          Run by {claimedByName}
        </p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-dim">
          They can edit this mandapam. If that&apos;s not right, report it from the
          card and we&apos;ll look.
        </p>
        <Link
          href={`/?p=${pandalId}`}
          className="numeric mt-3 inline-flex items-center gap-1.5 rounded-full text-[11px] uppercase tracking-[0.08em] text-kumkum underline decoration-kumkum/40 underline-offset-4 transition-opacity duration-150 ease-out hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric active:opacity-50"
        >
          <Icon name="arrowLeft" size={13} />
          Back to the card
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="display text-[24px] text-ink">Do you run this mandapam?</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">
        Claiming lets you fix the details, add photos, and puts your name on it as
        the committee. Whoever added it keeps their name too.
      </p>
      <button
        type="button"
        onClick={claim}
        disabled={pending}
        className="numeric mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-turmeric py-4 text-[12px] uppercase tracking-[0.08em] text-ink shadow-[0_2px_0_rgba(36,18,8,0.22)] transition-transform duration-150 ease-out hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:translate-y-px disabled:opacity-70"
      >
        {pending ? <Spinner size={15} /> : <Icon name="check" size={15} strokeWidth={2.4} />}
        {pending ? "Claiming…" : "Yes, I run this"}
      </button>
      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-kumkum/40 bg-kumkum/8 px-3.5 py-3 text-[13.5px] text-kumkum">
          {error}
        </p>
      )}
    </div>
  );
}
