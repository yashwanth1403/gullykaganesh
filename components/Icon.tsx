import type { SVGProps } from "react";

/**
 * Inline icon set. One stroke weight, one grid, drawn by hand so they sit at
 * the same optical weight as Karla at 11–15px — a stock 24px library set
 * reads heavy next to it. Every icon is decorative by default; pass `title`
 * where the icon is the only thing carrying meaning.
 */
const PATHS = {
  plus: <path d="M12 5v14M5 12h14" />,
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  // Marks a video where a still is shown in its place.
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
  arrowLeft: <path d="M19 12H5m6-6-6 6 6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  camera: (
    <>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.2-2h5.2l1.2 2h1.7A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </>
  ),
  ruler: (
    <>
      <path d="m3.5 15.5 12-12 5 5-12 12-5-5Z" />
      <path d="m7.5 11.5 2 2M10.5 8.5l2 2M13.5 5.5l2 2" />
    </>
  ),
  waves: (
    <path d="M3 9c2 0 2-1.5 4.5-1.5S10 9 12 9s2-1.5 4.5-1.5S19 9 21 9M3 15c2 0 2-1.5 4.5-1.5S10 15 12 15s2-1.5 4.5-1.5S19 15 21 15" />
  ),
  navigate: <path d="M20.5 3.5 3.5 10.5l8 2 2 8 7-17Z" />,
  share: (
    <>
      <path d="M12 3.5v11M8 7.5l4-4 4 4" />
      <path d="M5 12.5v5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20.5c.8-3.6 3.9-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  sparkle: (
    <path d="M12 3.5 13.9 9.6 20 11.5l-6.1 1.9L12 19.5l-1.9-6.1L4 11.5l6.1-1.9L12 3.5Z" />
  ),
  pen: (
    <>
      <path d="m4 20 4.2-1 10.3-10.3a2 2 0 0 0 0-2.8l-.4-.4a2 2 0 0 0-2.8 0L5 15.8 4 20Z" />
      <path d="m13.5 7.5 3 3" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m20.5 15.5-4.3-4.3a1 1 0 0 0-1.4 0L8 18" />
    </>
  ),
  // Instagram's glyph, redrawn on our grid and stroke so it doesn't shout.
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
    </>
  ),
  // A single leaf, for clay idols. Rounder than a generic "eco" sprout so it
  // reads at 10px next to a dot.
  leaf: (
    <>
      <path d="M19.5 4.5c-8 0-14 4.5-14 11 0 1.4.3 2.6.8 3.6C10 10.5 15 8 19.5 4.5Z" />
      <path d="M6.3 19.1C8 12.8 12 9 19.5 4.5" />
      <path d="M6.3 19.1c.7.5 1.6.8 2.7.8 5.6 0 9.7-4.5 10.5-11" />
    </>
  ),
  // Hearts are for photos only — the pandal gets a Morya, never a like.
  heart: (
    <path d="M12 20.3 4.9 13.4a4.4 4.4 0 0 1 0-6.3 4.5 4.5 0 0 1 6.3 0l.8.8.8-.8a4.5 4.5 0 0 1 6.3 0 4.4 4.4 0 0 1 0 6.3L12 20.3Z" />
  ),
  // A modak — Bappa's sweet. Marks the "Morya" tap; a heart would say the
  // wrong thing. The pleats keep it from reading as a plain teardrop.
  modak: (
    <>
      <path d="M12 3c-2.4 4.2-7 6.4-7 11a7 7 0 0 0 14 0c0-4.6-4.6-6.8-7-11Z" />
      <path d="M12 3.5V21M8.2 7.6 5.9 20M15.8 7.6l2.3 12.4" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

type Props = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: IconName;
  size?: number;
  title?: string;
};

export default function Icon({ name, size = 16, title, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}

/**
 * Indeterminate spinner. A partial ring that turns — the gap is what reads as
 * motion, so it stays legible at 14px in a button. `animate-spin` collapses
 * to a static arc under reduced-motion, which is still a clear "working".
 */
export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden
      focusable="false"
      className={`animate-spin shrink-0 ${className}`}
    >
      <circle cx="12" cy="12" r="8.5" className="opacity-25" />
      <path d="M20.5 12a8.5 8.5 0 0 0-8.5-8.5" />
    </svg>
  );
}
