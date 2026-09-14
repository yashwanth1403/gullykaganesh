"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setHeightVerified } from "@/app/admin/actions";
import Icon from "./Icon";

/**
 * Admins only, above the edit form: mark the claimed height as checked. A
 * toggle rather than a one-way stamp — a committee can swap the idol.
 */
export default function VerifyHeightButton({
  pandalId,
  heightFt,
  verified,
}: {
  pandalId: string;
  heightFt: number | null;
  verified: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!heightFt) return null;

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={verified}
      onClick={() =>
        startTransition(async () => {
          await setHeightVerified(pandalId, !verified);
          router.refresh();
        })
      }
      className={`numeric flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left text-[11px] uppercase tracking-[0.08em] transition-[background-color,border-color,transform] duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric active:scale-[0.99] disabled:opacity-60 ${
        verified
          ? "border-leaf bg-leaf/8 text-leaf"
          : "border-line bg-paper text-ink hover:bg-paper-warm"
      }`}
    >
      <span className="flex items-center gap-2">
        <Icon name={verified ? "check" : "ruler"} size={14} strokeWidth={verified ? 2.6 : 1.9} />
        {heightFt} ft — {verified ? "verified" : "claimed, not yet checked"}
      </span>
      <span className="text-ink-dim">{pending ? "Saving…" : verified ? "Unverify" : "Mark verified"}</span>
    </button>
  );
}
