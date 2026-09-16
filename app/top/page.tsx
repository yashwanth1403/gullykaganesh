import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import ShareButton from "@/components/ShareButton";
import SubpageHeader from "@/components/SubpageHeader";
import type { Pandal } from "@/lib/pandals";
import { getRecords, type Ranked } from "@/lib/records";

export const metadata: Metadata = {
  title: "Top Ganesh pandals of Hyderabad 2026",
  description:
    "Hyderabad's Ganesh pandals ranked by the people who visit them — tallest idols, most loved mandapams, oldest committees and clay Ganesh, updated live through Ganesh Chaturthi 2026.",
  alternates: { canonical: "/top" },
  openGraph: {
    title: "Top Ganesh pandals of Hyderabad 2026",
    description: "Tallest, most loved, oldest and clay — Hyderabad's Ganesh mandapams, ranked live by the people who go.",
    url: "/top",
  },
};

/** Same cadence as the map: the numbers move, the page follows within a minute. */
export const revalidate = 60;

/** Rank, thumbnail, name, and the number that earned the place. */
function Row({
  rank,
  pandal,
  value,
  sub,
}: {
  rank?: number;
  pandal: Pandal;
  value: string;
  sub?: string | null;
}) {
  const cover = pandal.photos[0];
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={`/?p=${pandal.id}`}
        className="-mx-2 flex items-center gap-3 rounded-[14px] px-2 py-2.5 transition-[background-color,transform] duration-150 ease-out hover:bg-paper-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-turmeric active:scale-[0.99]"
      >
        {rank !== undefined && (
          <span
            className={`display w-6 shrink-0 text-center text-[20px] leading-none ${rank <= 3 ? "text-kumkum" : "text-ink-dim"}`}
          >
            {rank}
          </span>
        )}
        <span
          className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[11px] bg-turmeric shadow-[inset_0_0_0_1px_rgba(36,18,8,0.08)]"
        >
          {cover ? (
            <Image src={cover.url} alt="" fill sizes="44px" loading={rank === 1 ? "eager" : undefined} className="object-cover" />
          ) : (
            <span aria-hidden className="display text-[20px] leading-none text-paper">
              {pandal.name.charAt(0)}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-tight text-ink">{pandal.name}</span>
          <span className="mt-0.5 block truncate text-[12.5px] leading-tight text-ink-dim">
            {pandal.gully} · {pandal.area}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="numeric block text-[15px] text-ink">{value}</span>
          {sub && (
            <span
              className={`numeric block text-[9px] uppercase tracking-[0.06em] ${sub === "verified" ? "text-leaf" : "text-ink-dim"}`}
            >
              {sub}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

function Section({
  icon,
  title,
  blurb,
  children,
}: {
  icon: IconName;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2 className="display flex items-center gap-2 text-[24px] leading-none text-ink">
        <Icon name={icon} size={18} className="text-kumkum" />
        {title}
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">{blurb}</p>
      <ul className="mt-3">{children}</ul>
    </section>
  );
}

/**
 * The hero: idols as bars, to scale. Rank numbers only — names live in the
 * list underneath where there's room to read them. Kumkum for the tallest,
 * turmeric for the rest; a leaf tick when an admin has checked the number.
 */
function Ladder({ rows }: { rows: Ranked[] }) {
  const max = rows[0]?.value ?? 1;
  return (
    <div className="mt-4 rounded-2xl border border-line bg-paper-warm px-3 pt-4 pb-3 shadow-[var(--shadow-elevated)]">
      <div className="flex items-end justify-around gap-2" style={{ height: 190 }}>
        {rows.map(({ pandal, value }, i) => (
          <div key={pandal.id} className="flex h-full w-full max-w-14 flex-col items-center justify-end">
            <span className="numeric mb-1 flex items-center gap-0.5 text-[11px] text-ink">
              {value}
              <span className="text-[9px] text-ink-dim">ft</span>
              {pandal.heightVerified && <Icon name="check" size={10} strokeWidth={3} className="text-leaf" />}
            </span>
            <div
              className={`w-full rounded-t-[6px] ${i === 0 ? "bg-kumkum" : "bg-turmeric"}`}
              style={{ height: `${Math.max(6, (value / max) * 100)}%` }}
            />
            <span className={`display mt-1.5 text-[15px] leading-none ${i < 3 ? "text-kumkum" : "text-ink-dim"}`}>
              {i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function TopPage() {
  const r = await getRecords();
  const empty =
    r.tallest.length + r.mostLoved.length + r.risingToday.length + r.mostVisitedToday.length +
      r.oldest.length + r.clay.length ===
    0;

  return (
    <main className="min-h-dvh bg-paper">
      <SubpageHeader />
      <div className="mx-auto max-w-md px-gutter pt-6 pb-[max(3rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3">
          {/* The figure sits beside the title, not above it: the ladder is the
              hero of this page, and a big illustration would push it down. */}
          <div className="flex items-start gap-3">
            <Image
              src="/brand/ganesh-480.webp"
              alt=""
              width={72}
              height={77}
              priority
              className="mt-0.5 h-[77px] w-auto shrink-0"
            />
            <div>
            <h1 className="display text-[34px] leading-[1.05] text-ink">Top of the city</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">
              {r.festivalDay
                ? `Day ${r.festivalDay}. Ranked by the people who go, not by us.`
                : "Ranked by the people who go, not by us. Numbers start moving on Chaturthi."}
            </p>
            </div>
          </div>
          <div className="mt-1 shrink-0">
            <ShareButton title="Top Ganesh of Hyderabad" text="Tallest, most loved, oldest — Hyderabad's Ganesh mandapams, ranked." path="/top" />
          </div>
        </div>

        {empty && (
          <div className="mt-10 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-[14px] leading-relaxed text-ink-dim">
            <Image src="/brand/ganesh-480.webp" alt="" width={168} height={180} className="mx-auto h-[180px] w-auto" />
            <p className="mt-3">
              Nothing to rank yet. Say Morya to a mandapam, check in when you get there, and this
              page fills itself.
            </p>
          </div>
        )}

        {r.tallest.length > 0 && (
          <section className="mt-8">
            <h2 className="display flex items-center gap-2 text-[24px] leading-none text-ink">
              <Icon name="ruler" size={18} className="text-kumkum" />
              Tallest
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">
              Heights as the committee tells them. A green tick means we&apos;ve checked.
            </p>
            <Ladder rows={r.tallest.slice(0, 6)} />
            <ul className="mt-3">
              {r.tallest.map(({ pandal, value }, i) => (
                <Row
                  key={pandal.id}
                  rank={i + 1}
                  pandal={pandal}
                  value={`${value} ft`}
                  sub={pandal.heightVerified ? "verified" : "claimed"}
                />
              ))}
            </ul>
          </section>
        )}

        {r.mostLoved.length > 0 && (
          <Section icon="modak" title="Most loved" blurb="One Morya per person per mandapam, all festival long.">
            {r.mostLoved.map(({ pandal, value }, i) => (
              <Row key={pandal.id} rank={i + 1} pandal={pandal} value={String(value)} sub="moryas" />
            ))}
          </Section>
        )}

        {r.risingToday.length > 0 && (
          <Section icon="sparkle" title="Rising today" blurb="Moryas since midnight — where the city is heading right now.">
            {r.risingToday.map(({ pandal, value }, i) => (
              <Row key={pandal.id} rank={i + 1} pandal={pandal} value={`+${value}`} sub="today" />
            ))}
          </Section>
        )}

        {r.mostVisitedToday.length > 0 && (
          <Section icon="pin" title="Darshan today" blurb="Check-ins from within 300 m of the pin. Phones, not taps.">
            {r.mostVisitedToday.map(({ pandal, value }, i) => (
              <Row key={pandal.id} rank={i + 1} pandal={pandal} value={String(value)} sub="check-ins" />
            ))}
          </Section>
        )}

        {r.byArea.length > 1 && (
          <Section icon="navigate" title="Loved by area" blurb="The favourite in each part of town.">
            {r.byArea.map(({ area, pandal }) => (
              <Row key={pandal.id} pandal={pandal} value={String(pandal.moryaCount)} sub={area} />
            ))}
          </Section>
        )}

        {r.smallest.length > 0 && (
          <Section
            icon="pin"
            title="Smallest gully Ganesh"
            blurb="The ones this map is named for. No landmarks allowed here."
          >
            {r.smallest.map(({ pandal, value }, i) => (
              <Row key={pandal.id} rank={i + 1} pandal={pandal} value={`${value} ft`} sub={pandal.heightVerified ? "verified" : "claimed"} />
            ))}
          </Section>
        )}

        {r.oldest.length > 0 && (
          <Section icon="calendar" title="Oldest committees" blurb="Years of Ganesh in the same lane.">
            {r.oldest.map(({ pandal, value }, i) => (
              <Row key={pandal.id} rank={i + 1} pandal={pandal} value={`Since ${value}`} sub={`${new Date().getFullYear() - value} years`} />
            ))}
          </Section>
        )}

        {r.clay.length > 0 && (
          <Section icon="leaf" title="Clay idols" blurb="Natural idols that go back to the lake as mud, not plaster.">
            {r.clay.map((pandal) => (
              <Row key={pandal.id} pandal={pandal} value={String(pandal.moryaCount)} sub="moryas" />
            ))}
          </Section>
        )}
      </div>
    </main>
  );
}
