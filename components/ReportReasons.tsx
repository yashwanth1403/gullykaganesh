"use client";

/**
 * The "what's wrong?" chips, shared by the pandal card and the photo viewer.
 * `dark` flips the palette for the lightbox, which sits on ink.
 */
export default function ReportReasons<K extends string>({
  reasons,
  onPick,
  pending,
  dark,
  label = "What's wrong?",
}: {
  reasons: Record<K, string>;
  onPick: (reason: K) => void;
  pending: boolean;
  dark?: boolean;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {(Object.entries(reasons) as [K, string][]).map(([key, text]) => (
        <button
          key={key}
          type="button"
          disabled={pending}
          onClick={() => onPick(key)}
          className={`rounded-full border px-3 py-1.5 text-[12px] transition-[background-color,transform] duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric active:scale-[0.97] disabled:opacity-60 ${
            dark
              ? "border-paper/25 bg-paper/10 text-paper hover:bg-paper/20"
              : "border-line bg-paper text-ink hover:bg-paper-warm"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
