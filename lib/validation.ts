import { z } from "zod";
import { VISARJAN_DAYS } from "./pandals";

/** Greater Hyderabad, with margin. Anything outside is a mis-drop, not a pandal. */
export const HYDERABAD_BOUNDS = { west: 78.1, south: 17.1, east: 78.8, north: 17.7 };

export const MAX_PHOTOS = 6;
/** The only type the client resizer emits and the only type R2 accepts. */
export const PHOTO_CONTENT_TYPE = "image/jpeg";

const trimmed = (max: number) => z.string().trim().min(1).max(max);

/** Accepts "@Handle", "handle", or an instagram.com URL; stores a bare handle. */
export const instagramHandle = z
  .string()
  .trim()
  .transform((s) =>
    s
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/[/?].*$/, "")
      .replace(/^@/, "")
      .toLowerCase(),
  )
  .pipe(z.string().regex(/^[a-z0-9._]{1,30}$/, "That doesn't look like an Instagram handle"));

export const pandalInput = z.object({
  name: trimmed(80),
  gully: trimmed(80),
  area: trimmed(60),
  instagramHandle: z
    .string()
    .trim()
    .transform((s) => s || null)
    .pipe(instagramHandle.nullable()),
  // Empty input coerces to 0 otherwise, which would hit the wrong message.
  heightFt: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce
      .number({ message: "How tall is the idol, in feet?" })
      .int("Whole feet only")
      .min(1, "Height must be at least 1 ft")
      .max(150, "Height can't be more than 150 ft"),
  ),
  establishedYear: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce
      .number({ message: "Which year did the committee start?" })
      .int("A year, like 1954")
      .min(1800, "That's too early")
      .max(new Date().getFullYear(), "That's in the future")
      .nullable(),
  ),
  // A checkbox posts "on" or nothing; a JSON caller may send a boolean.
  ecoFriendly: z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean()),
  theme: z.preprocess(
    (v) => (v == null ? "" : v),
    z.string().trim().max(80, "Keep the theme under 80 characters").transform((s) => s || null),
  ),
  visarjanDay: z.coerce.number().refine((d): d is (typeof VISARJAN_DAYS)[number] =>
    (VISARJAN_DAYS as number[]).includes(d),
  ),
  lat: z.coerce.number().min(HYDERABAD_BOUNDS.south).max(HYDERABAD_BOUNDS.north),
  lng: z.coerce.number().min(HYDERABAD_BOUNDS.west).max(HYDERABAD_BOUNDS.east),
  photos: z
    .array(
      z.object({
        key: z.string().min(1),
        width: z.number().int().min(1).max(10_000),
        height: z.number().int().min(1).max(10_000),
      }),
    )
    .min(1, "Add at least one photo")
    .max(MAX_PHOTOS),
  /** Which of `photos` goes on the map pin. Omitted: the most-liked one does. */
  pinIndex: z.number().int().min(0).max(MAX_PHOTOS - 1).optional(),
});

export type PandalInput = z.infer<typeof pandalInput>;
