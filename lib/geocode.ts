/** Lane and locality under a point, via /api/geocode. Nulls when unknown. */
export type Place = { gully: string | null; area: string | null };

export async function reverseGeocode(lng: number, lat: number, signal?: AbortSignal): Promise<Place> {
  const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`, { signal });
  if (!res.ok) return { gully: null, area: null };
  return (await res.json()) as Place;
}
