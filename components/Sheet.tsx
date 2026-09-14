"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
  children: ReactNode;
};

const PEEK_PX = 236;

/**
 * Bottom sheet on phones, left rail on desktop.
 *
 * The sheet pattern is conventional for map products, and deliberately so —
 * this is muscle memory people already have. The distinctiveness in this page
 * is spent on the palette, the type, and the urgency system, not on inventing
 * a novel way to drag a panel.
 */
export default function Sheet({ expanded, onExpandedChange, children }: Props) {
  const sheetRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const startY = useRef(0);

  // Collapsing should also rewind the list, or reopening lands mid-scroll.
  useEffect(() => {
    if (!expanded && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [expanded]);

  function onPointerDown(e: React.PointerEvent) {
    startY.current = e.clientY;
    setDrag(0);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (drag === null) return;
    const dy = e.clientY - startY.current;
    // Resist dragging past each end rather than hard-stopping.
    setDrag(expanded ? Math.max(dy, -40) : Math.min(dy, 40));
  }

  function onPointerUp() {
    if (drag === null) return;
    if (expanded && drag > 70) onExpandedChange(false);
    else if (!expanded && drag < -50) onExpandedChange(true);
    setDrag(null);
  }

  const base = expanded ? 0 : `calc(78dvh - ${PEEK_PX}px)`;
  const transform =
    drag !== null
      ? `translate3d(0, calc(${base} + ${drag}px), 0)`
      : `translate3d(0, ${base}, 0)`;

  return (
    <section
      ref={sheetRef}
      aria-label="Mandapams near you"
      style={{ transform }}
      className={[
        "absolute inset-x-0 bottom-0 z-10 flex h-[78dvh] flex-col",
        "rounded-t-[20px] border-t border-line bg-paper",
        "shadow-[var(--shadow-floating)]",
        drag === null
          ? "transition-transform duration-[420ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
          : "",
        // Desktop: a rail beside the map, always open, never dragged.
        "md:inset-y-0 md:right-auto md:left-0 md:h-full md:w-[380px]",
        "md:rounded-none md:border-r md:border-t-0 md:!transform-none",
      ].join(" ")}
    >
      {/* Handle: the whole strip is the target, not just the 36px bar. */}
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => drag === null && onExpandedChange(!expanded)}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse list" : "Expand list"}
        className="grid w-full shrink-0 touch-none place-items-center py-3 md:hidden"
      >
        <span className="h-1 w-9 rounded-full bg-line" />
      </button>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:pt-[136px]"
      >
        {children}
      </div>
    </section>
  );
}
