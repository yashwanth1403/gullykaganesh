import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import SubpageHeader from "@/components/SubpageHeader";
import { annadhanamLabel, thumbUrl, visarjanDate } from "@/lib/pandals";
import { getLivePandal } from "@/lib/queries";
import { SITE_NAME, SITE_URL, absoluteUrl, jsonLd } from "@/lib/site";

/**
 * The page a search engine lands on for one pandal. The map itself is one
 * cached route with everything drawn client-side, so nothing on it is
 * indexable per mandapam; this is the plain-HTML twin of the detail sheet,
 * with the map one tap away.
 */

/** Same cadence as the map: an edit shows up here within the minute. */
export const revalidate = 60;

/**
 * Nothing at build time; each pandal is rendered on first visit and then
 * served from cache. Without this export the route is fully dynamic and every
 * crawl is a fresh DB query.
 */
export function generateStaticParams() {
  return [];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string) {
  if (!UUID.test(id)) return null;
  return getLivePandal(id);
}

/** "ISRO-themed Ganesh at Lane 4, Kukatpally…" — what the SERP and WhatsApp preview say. */
function summarise(p: NonNullable<Awaited<ReturnType<typeof load>>>): string {
  const what = p.theme ? `${p.theme}-themed Ganesh pandal` : "Ganesh pandal";
  const facts = [
    p.heightFt ? `${p.heightFt} ft idol` : null,
    p.establishedYear ? `since ${p.establishedYear}` : null,
    p.ecoFriendly ? "clay idol" : null,
  ].filter(Boolean);
  const lead = `${what} at ${p.gully}, ${p.area}, Hyderabad${facts.length ? ` — ${facts.join(", ")}` : ""}.`;
  const rest = p.description?.trim();
  return rest ? `${lead} ${rest}`.slice(0, 300) : `${lead} Photos, visarjan date and directions on ${SITE_NAME}.`;
}

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = await load(id);
  if (!p) return { title: "Not found", robots: { index: false } };

  const title = `${p.name} — Ganesh pandal in ${p.area}, Hyderabad`;
  const description = summarise(p);
  const cover = p.photos[0]?.url;
  return {
    title: { absolute: `${title} | ${SITE_NAME}` },
    description,
    alternates: { canonical: `/p/${p.id}` },
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/p/${p.id}`),
      siteName: SITE_NAME,
      type: "website",
      locale: "en_IN",
      images: cover ? [{ url: cover, alt: `${p.name}, ${p.area}` }] : undefined,
    },
    twitter: { card: cover ? "summary_large_image" : "summary", title, description },
  };
}

function Tag({ icon, tone, children }: { icon: "sparkle" | "calendar" | "leaf"; tone?: "leaf"; children: React.ReactNode }) {
  return (
    <li
      className={`flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-2 ${
        tone === "leaf" ? "border-leaf/40 bg-leaf/8 text-leaf" : "border-line bg-paper text-ink"
      }`}
    >
      <Icon name={icon} size={12} className={tone ? undefined : icon === "sparkle" ? "text-turmeric" : "opacity-70"} />
      {children}
    </li>
  );
}

export default async function PandalPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const p = await load(id);
  if (!p) notFound();

  const cover = p.photos[0];
  const mapHref = `/?p=${p.id}`;

  const placeJsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    "@id": absoluteUrl(`/p/${p.id}#place`),
    name: p.name,
    description: summarise(p),
    url: absoluteUrl(`/p/${p.id}`),
    image: p.photos.map((ph) => ph.url),
    isAccessibleForFree: true,
    touristType: "Ganesh Chaturthi devotees",
    geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng },
    address: {
      "@type": "PostalAddress",
      streetAddress: p.gully,
      addressLocality: `${p.area}, Hyderabad`,
      addressRegion: "Telangana",
      addressCountry: "IN",
    },
    hasMap: absoluteUrl(mapHref),
    ...(p.theme ? { keywords: `${p.theme} Ganesh, ${p.area} Ganesh pandal` } : {}),
    ...(p.organisation ? { sponsor: { "@type": "Organization", name: p.organisation } } : {}),
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };

  return (
    <main className="min-h-dvh bg-paper">
      <SubpageHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(placeJsonLd) }} />

      <article className="mx-auto max-w-md px-gutter pt-5 pb-[max(3rem,env(safe-area-inset-bottom))]">
        {cover ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-paper-warm shadow-[var(--shadow-elevated)]">
            <Image
              src={cover.url}
              alt={`${p.name}, ${p.gully}, ${p.area}`}
              fill
              priority
              sizes="(max-width: 448px) 100vw, 448px"
              className="object-cover"
            />
            {cover.video && (
              <span className="absolute right-3 bottom-3 grid h-9 w-9 place-items-center rounded-full bg-ink/70 text-paper">
                <Icon name="play" size={16} />
              </span>
            )}
          </div>
        ) : (
          <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-turmeric/25">
            <Image src="/brand/ganesh-480.webp" alt="" width={140} height={150} priority className="h-[150px] w-auto" />
          </div>
        )}

        <h1 className="display mt-5 text-[32px] leading-[1.05] text-ink">{p.name}</h1>
        <p className="mt-2 flex items-start gap-1.5 text-[14px] leading-[1.6] text-ink-dim">
          <Icon name="pin" size={14} className="mt-1 shrink-0 opacity-70" />
          <span>
            {p.gully}, {p.area}, Hyderabad
            {p.organisation && <span className="block text-[13px]">{p.organisation}</span>}
          </span>
        </p>

        {(p.theme || p.establishedYear || p.ecoFriendly || p.annadhanamDate) && (
          <ul className="mt-3 flex flex-wrap gap-1.5 text-[12.5px]">
            {p.theme && <Tag icon="sparkle">{p.theme}</Tag>}
            {p.establishedYear && <Tag icon="calendar">Since {p.establishedYear}</Tag>}
            {p.annadhanamDate && <Tag icon="modak">Annadhanam {annadhanamLabel(p.annadhanamDate)}</Tag>}
            {p.ecoFriendly && <Tag icon="leaf" tone="leaf">Clay idol</Tag>}
          </ul>
        )}

        <Link
          href={mapHref}
          className="numeric mt-5 flex items-center justify-center gap-2 rounded-full bg-kumkum py-3.5 text-[12px] uppercase tracking-[0.08em] text-paper shadow-[0_2px_0_rgba(36,18,8,0.3)] transition-transform duration-150 ease-out hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:translate-y-px"
        >
          <Icon name="navigate" size={15} />
          Open on the map
        </Link>

        <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
          {(
            [
              ["ruler", "Height", p.heightFt ? `${p.heightFt} ft` : "—", p.heightFt ? (p.heightVerified ? "verified" : "claimed") : null],
              ["waves", "Visarjan", visarjanDate(p), `day ${p.visarjanDay}`],
              ["modak", "Moryas", String(p.moryaCount), null],
            ] as const
          ).map(([icon, label, value, sub]) => (
            <div key={label} className="bg-paper px-2 py-3 text-center">
              <dt className="numeric flex items-center justify-center gap-1 text-[9.5px] uppercase tracking-[0.07em] text-ink-dim">
                <Icon name={icon} size={12} />
                {label}
              </dt>
              <dd className="numeric mt-1 text-[15px] leading-tight text-ink">
                {value}
                {sub && (
                  <span className={`mt-0.5 block text-[8.5px] uppercase tracking-[0.06em] ${sub === "verified" ? "text-leaf" : "text-ink-dim"}`}>
                    {sub}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {p.description && (
          <p className="mt-5 text-[15px] leading-[1.7] whitespace-pre-line text-ink">{p.description}</p>
        )}

        {p.photos.length > 1 && (
          <ul className="mt-5 grid grid-cols-3 gap-1.5">
            {p.photos.slice(1, 7).map((ph) => (
              <li key={ph.id} className="relative aspect-square overflow-hidden rounded-[11px] bg-paper-warm">
                <Image src={thumbUrl(ph.url)} alt={`${p.name} — photo`} fill sizes="140px" className="object-cover" />
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-[13px] leading-relaxed text-ink-dim">
          {p.addedBy ? `Added by ${p.addedBy}. ` : ""}
          {p.instagramHandle && (
            <>
              On Instagram:{" "}
              <a href={`https://instagram.com/${p.instagramHandle}`} rel="noopener" className="text-kumkum underline decoration-kumkum/40 underline-offset-4">
                @{p.instagramHandle}
              </a>
              .{" "}
            </>
          )}
          Run this mandapam?{" "}
          <Link href={`/p/${p.id}/manage`} className="text-kumkum underline decoration-kumkum/40 underline-offset-4">
            Edit or claim it
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
