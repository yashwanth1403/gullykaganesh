import Link from "next/link";
import Icon from "./Icon";

/**
 * The kumkum masthead every page off the map shares: /add, /p/[id]/manage,
 * /admin. Identical markup in each page's loading.tsx so it never flickers
 * between the skeleton and the real page.
 */
export default function SubpageHeader() {
  return (
    <header className="bg-kumkum px-gutter pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <Link
          href="/"
          className="numeric flex items-center gap-1.5 rounded-full py-1.5 pr-3 pl-1.5 text-[11px] uppercase tracking-[0.08em] text-paper/90 transition-transform duration-150 ease-out hover:-translate-x-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric active:translate-x-px"
        >
          <Icon name="x" size={14} strokeWidth={2.4} />
          Back to map
        </Link>
        <span className="display text-[20px] text-paper">
          Gully<span className="text-turmeric">Ka</span>Ganesh
        </span>
      </div>
    </header>
  );
}
