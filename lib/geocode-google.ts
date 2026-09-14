/**
 * Parsing for Google's reverse-geocode payload, kept out of the route file
 * so it can be exercised without a key or a network.
 */

export type GoogleResult = {
  types: string[];
  address_components: { long_name: string; types: string[] }[];
};

export type Place = { gully: string | null; area: string | null };

/** Google's area ranking, most specific first. `locality` is the city, so it's excluded. */
const AREA_TYPES = ["sublocality_level_1", "sublocality", "neighborhood", "sublocality_level_2"];
const GULLY_TYPES = ["route", "sublocality_level_2", "sublocality_level_3"];

/** Pulls gully and area out of a Google reverse-geocode payload. */
export function parseGoogle(results: GoogleResult[]): Place {
  // Plus codes carry no address components worth reading.
  const usable = results.filter((r) => !r.types.includes("plus_code"));
  const find = (types: string[]) => {
    for (const t of types) {
      for (const r of usable) {
        const c = r.address_components.find((c) => c.types.includes(t));
        const name = c?.long_name.trim();
        // Google's placeholder for a way it has no name for, common in India.
        if (name && !/^unnamed road$/i.test(name)) return name;
      }
    }
    return null;
  };
  const gully = find(GULLY_TYPES);
  let area = find(AREA_TYPES);
  // A lane that came back as the area too is not an area.
  if (area && gully && area.toLowerCase() === gully.toLowerCase()) area = find(AREA_TYPES.slice(1));
  return { gully, area };
}
