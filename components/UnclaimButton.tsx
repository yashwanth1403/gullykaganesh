"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { unclaimPandal } from "@/app/p/[id]/actions";

/** Under the edit form, for the claimant only: take your name off it. */
export default function UnclaimButton({ pandalId }: { pandalId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await unclaimPandal(pandalId);
          router.refresh();
        })
      }
      className="numeric rounded-full text-[11px] uppercase tracking-[0.08em] text-ink-dim underline decoration-line underline-offset-4 transition-opacity duration-150 ease-out hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric active:opacity-50 disabled:opacity-50"
    >
      {pending ? "Removing…" : "Not yours any more? Remove my claim"}
    </button>
  );
}
