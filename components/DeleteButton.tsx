"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePandal } from "@/app/p/[id]/actions";
import Icon, { Spinner } from "./Icon";

/**
 * Take a mandapam off the map. Two taps — the first just opens the
 * confirmation — because there is no undo short of an admin.
 */
export default function DeleteButton({ pandalId, name }: { pandalId: string; name: string }) {
  const router = useRouter();
  const [arming, setArming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const r = await deletePandal(pandalId);
      if (r.ok) {
        router.push("/");
        return;
      }
      setError(
        r.error === "forbidden"
          ? "You can't delete this one."
          : r.error === "gone"
            ? "It's already gone."
            : "That didn't go through. Try again.",
      );
    });
  }

  if (!arming) {
    return (
      <button
        type="button"
        onClick={() => setArming(true)}
        className="numeric rounded-full text-[11px] uppercase tracking-[0.08em] text-kumkum underline decoration-kumkum/40 underline-offset-4 transition-opacity duration-150 ease-out hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric active:opacity-50"
      >
        Delete this mandapam
      </button>
    );
  }

  return (
    <div className="animate-rise rounded-xl border border-kumkum/40 bg-kumkum/8 px-4 py-4 text-left" role="alertdialog" aria-labelledby="delete-title">
      <p id="delete-title" className="text-[14.5px] font-semibold text-ink">
        Delete {name}?
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-dim">
        It comes off the map now and its photos are deleted. There&apos;s no undo.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="numeric flex flex-1 items-center justify-center gap-1.5 rounded-full bg-kumkum py-3 text-[11px] uppercase tracking-[0.08em] text-paper shadow-[0_2px_0_rgba(36,18,8,0.3)] transition-transform duration-150 ease-out hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:translate-y-px disabled:opacity-70"
        >
          {pending ? <Spinner size={14} /> : <Icon name="x" size={14} strokeWidth={2.4} />}
          {pending ? "Deleting…" : "Yes, delete it"}
        </button>
        <button
          type="button"
          onClick={() => setArming(false)}
          disabled={pending}
          className="numeric flex-1 rounded-full border border-line bg-paper py-3 text-[11px] uppercase tracking-[0.08em] text-ink transition-[transform,background-color] duration-150 ease-out hover:bg-paper-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric active:translate-y-px disabled:opacity-70"
        >
          Keep it
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-kumkum">
          {error}
        </p>
      )}
    </div>
  );
}
