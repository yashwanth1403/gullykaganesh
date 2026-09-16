/**
 * One place for what search engines and share sheets are told about the site.
 * Page metadata, the sitemap, robots and the JSON-LD all read from here so a
 * change of tagline doesn't leave a stale copy in a <meta> tag somewhere.
 */
export const SITE_URL = "https://gullykaganesh.in";
export const SITE_NAME = "GullyKaGanesh";

/** What the site is, in the words people search for. Under 160 chars. */
export const SITE_DESCRIPTION =
  "Hyderabad's crowdsourced map of unique Ganesh pandals and mandapams. Find creative Ganesh idol themes near you, plan your darshan route and add your gully's Ganesh.";

export const SITE_TITLE = "GullyKaGanesh — Unique Ganesh pandals & mandapams across Hyderabad";

/** Google ignores these; Bing and the Indian aggregators still read them. */
export const SITE_KEYWORDS = [
  "GullyKaGanesh",
  "Gully Ka Ganesh",
  "unique Ganesh pandals Hyderabad",
  "Ganesh pandals in Hyderabad",
  "Ganesh mandapam Hyderabad",
  "Ganesh Chaturthi 2026 Hyderabad",
  "Vinayaka Chavithi Hyderabad",
  "Ganesh idol themes Hyderabad",
  "Ganesh pandal near me",
  "Hyderabad Ganesh darshan route",
  "Khairatabad Ganesh",
  "Ganesh visarjan Hyderabad",
];

/** Absolute URL for a path, for canonicals, the sitemap and JSON-LD. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

/** JSON-LD as a script body. `<` is escaped so user text can't close the tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
