"use client";

import { useState } from "react";
import Icon from "./Icon";

/** Native share sheet where there is one, clipboard elsewhere. Same as the pandal card. */
export default function ShareButton({ title, text, path }: { title: string; text: string; path: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // Dismissed the sheet — nothing to report.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="numeric flex items-center gap-1.5 rounded-full border border-line bg-paper py-2 pr-3.5 pl-3 text-[11px] uppercase tracking-[0.08em] text-ink transition-[transform,background-color] duration-150 ease-out hover:-translate-y-px hover:bg-paper-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric active:translate-y-px"
    >
      <Icon name={copied ? "check" : "share"} size={13} />
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
