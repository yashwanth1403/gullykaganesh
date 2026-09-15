import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  geometry,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Postgres schema for GullyKaGanesh. Column shapes mirror the frontend
 * `Pandal` type in lib/pandals.ts so the hardcoded data can be swapped for
 * queries without a UI rewrite.
 *
 * Geometry columns are PostGIS `geometry(Point, 4326)` in `xy` mode:
 * `{ x: lng, y: lat }`. The order trips people up — MapLibre also uses
 * [lng, lat], so it is at least consistent with the map.
 *
 * All access goes through Drizzle on the server. Tables have RLS enabled with
 * no policies (see drizzle/0001_supabase_auth_rls.sql) so Supabase's REST
 * endpoint exposes nothing to the anon key.
 */

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};

/**
 * Moderation state for user-generated content. Submissions go live
 * immediately; a report can flip them to `hidden`. `removed` is a soft delete
 * that keeps the row for audit while the photos are purged from R2.
 */
export const contentStatus = pgEnum("content_status", [
  "live",
  "hidden",
  "removed",
]);

/**
 * One row per Supabase Auth user. `id` is `auth.users.id`; the FK and the
 * signup trigger that creates the row live in a hand-written migration because
 * drizzle-kit only manages the public schema.
 */
export const profiles = pgTable("profiles", {
  id: uuid().primaryKey(),
  /** Shown as "added by …" on pandal cards. */
  displayName: text().notNull(),
  /** Moderators. Set by hand in SQL; there is no UI for it. */
  isAdmin: boolean().notNull().default(false),
  ...timestamps,
});

export const pandals = pgTable(
  "pandals",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    /** The lane itself — the "gully" the project is named for. */
    gully: text().notNull(),
    area: text().notNull(),
    /** The committee / youth association / society that runs the pandal. */
    organisation: text(),
    /** Stored without the leading "@". Validated against Instagram's rules. */
    instagramHandle: text(),
    location: geometry({ type: "point", mode: "xy", srid: 4326 }).notNull(),
    heightFt: integer(),
    /**
     * Sum of `moryas.weight` for this pandal, maintained by a trigger (see
     * drizzle/0004). Denormalised so the map query stays single-table.
     */
    moryaCount: integer().notNull().default(0),
    /** Geofenced "darshan done" check-ins, all days. Kept in sync by a trigger on `visits`. */
    visitCount: integer().notNull().default(0),
    /**
     * Heights are self-reported. An admin flips this once someone has
     * actually seen the idol, so the tallest list can say which numbers are
     * claims and which are checked.
     */
    heightVerified: boolean().notNull().default(false),
    /** Year the committee first put up a Ganesh — for the "oldest" record. */
    establishedYear: smallint(),
    /** Clay / natural idol. Listed as a filter and a record because people ask. */
    ecoFriendly: boolean().notNull().default(false),
    /** This year's theme, if the mandapam has one ("ISRO", "Ayodhya temple"). */
    theme: text(),
    /** A few lines from the committee — what to expect, timings, history. */
    description: text(),
    /** Immersion day within the festival, 1 through 16. */
    visarjanDay: smallint().notNull(),
    /** City-famous pandals, pre-seeded. Everything else is user-submitted. */
    landmark: boolean().notNull().default(false),
    verified: boolean().notNull().default(false),
    status: contentStatus().notNull().default("live"),
    /** Null for seeded landmarks, which have no submitting user. */
    submittedBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    /**
     * The user who said "I run this mandapam". First claim wins, instantly;
     * a wrong one is reported and cleared by an admin. Edits are open to the
     * uploader and the claimant both — see lib/permissions.ts.
     */
    claimedBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    claimedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // The viewport query: `location && ST_MakeEnvelope(...)`.
    index("pandals_location_gist").using("gist", t.location),
    index("pandals_submitted_by_idx").on(t.submittedBy),
    index("pandals_claimed_by_idx").on(t.claimedBy),
    check("pandals_visarjan_day_check", sql`${t.visarjanDay} between 1 and 16`),
    check("pandals_established_year_check", sql`${t.establishedYear} between 1800 and 2100`),
    check(
      "pandals_instagram_handle_check",
      sql`${t.instagramHandle} ~ '^[A-Za-z0-9._]{1,30}$'`,
    ),
  ],
);

/**
 * Photos and short videos share one table (and one name, for history's
 * sake): likes, reports, the pin choice and moderation all apply the same
 * way to both. A video row also carries a poster JPEG, captured in the
 * browser at upload time, which is what every thumbnail and pin shows.
 */
export const mediaKind = pgEnum("media_kind", ["photo", "video"]);

export const photos = pgTable(
  "photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    pandalId: uuid()
      .notNull()
      .references(() => pandals.id, { onDelete: "cascade" }),
    /** Object key in the R2 bucket. The public URL is derived, not stored. */
    r2Key: text().notNull().unique(),
    kind: mediaKind().notNull().default("photo"),
    /** Video only: R2 key of the poster frame. Null for photos. */
    posterKey: text(),
    /** Video only: length in whole seconds, for the badge on the tile. */
    durationS: smallint(),
    width: integer().notNull(),
    height: integer().notNull(),
    /** Hearts from viewers. Trigger-maintained. */
    likeCount: integer().notNull().default(0),
    /**
     * The uploader's pick for the map pin. Wins over likes as the cover;
     * when none is set (or it gets hidden) the most-liked live photo is.
     * At most one per pandal — see the partial unique index.
     */
    isPin: boolean().notNull().default(false),
    status: contentStatus().notNull().default("live"),
    uploadedBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("photos_pandal_id_idx").on(t.pandalId),
    uniqueIndex("photos_pin_per_pandal").on(t.pandalId).where(sql`${t.isPin}`),
    check("photos_video_has_poster", sql`${t.kind} <> 'video' or ${t.posterKey} is not null`),
  ],
);

/**
 * User reports against a pandal or a single photo. Reviewing one and setting
 * the target's status to `hidden` is the whole moderation flow.
 */
export const reports = pgTable(
  "reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    pandalId: uuid().references(() => pandals.id, { onDelete: "cascade" }),
    photoId: uuid().references(() => photos.id, { onDelete: "cascade" }),
    reporterId: uuid().references(() => profiles.id, { onDelete: "set null" }),
    reason: text().notNull(),
    resolvedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "reports_target_check",
      sql`${t.pandalId} is not null or ${t.photoId} is not null`,
    ),
    // One open report per user per target. Resolving clears the way for a
    // fresh one, so a repeat offender can still be flagged again.
    uniqueIndex("reports_open_pandal_reporter")
      .on(t.pandalId, t.reporterId)
      .where(sql`${t.resolvedAt} is null`),
    uniqueIndex("reports_open_photo_reporter")
      .on(t.photoId, t.reporterId)
      .where(sql`${t.resolvedAt} is null`),
  ],
);

/**
 * "Ganpati Bappa Morya" — the one-tap reaction. The composite key is the
 * one-per-user rule; the app toggles by inserting or deleting. `weight` is 0
 * for accounts younger than a few minutes so a burst of fresh sign-ups
 * can't move the leaderboard; the row is still kept so the tap sticks for
 * that user. A trigger recomputes `pandals.morya_count` on every change.
 */
export const moryas = pgTable(
  "moryas",
  {
    pandalId: uuid()
      .notNull()
      .references(() => pandals.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    weight: smallint().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.pandalId, t.userId] }),
    // The hourly rate-limit query.
    index("moryas_user_id_idx").on(t.userId),
  ],
);

/**
 * "Darshan done" — a check-in that only counts if the phone was within a few
 * hundred metres of the pin (the server checks; see app/actions/visit.ts).
 * One per user per pandal per festival day, so "most visited today" is an
 * honest number rather than a tap counter.
 */
export const visits = pgTable(
  "visits",
  {
    pandalId: uuid()
      .notNull()
      .references(() => pandals.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** Festival day (1–13) the check-in happened on, by IST. */
    festivalDay: smallint().notNull(),
    /** How far the phone was from the pin, for later tuning of the fence. */
    distanceM: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.pandalId, t.userId, t.festivalDay] }),
    index("visits_user_id_idx").on(t.userId),
  ],
);

/** One heart per viewer per photo. Summed into `photos.like_count` by trigger. */
export const photoLikes = pgTable(
  "photo_likes",
  {
    photoId: uuid()
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.photoId, t.userId] }),
    index("photo_likes_user_id_idx").on(t.userId),
  ],
);

/**
 * Sponsored placements — the revenue model. A sponsor is either attached to a
 * pandal (shown on its card) or a standalone business with its own pin, so
 * exactly one of `pandalId` / `location` must be set. Schema only for now;
 * there is no UI until there is a paying sponsor.
 */
export const sponsoredListings = pgTable(
  "sponsored_listings",
  {
    id: uuid().primaryKey().defaultRandom(),
    pandalId: uuid().references(() => pandals.id, { onDelete: "cascade" }),
    location: geometry({ type: "point", mode: "xy", srid: 4326 }),
    businessName: text().notNull(),
    tagline: text(),
    url: text(),
    phone: text(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("sponsored_listings_location_gist").using("gist", t.location),
    check(
      "sponsored_listings_target_check",
      sql`(${t.pandalId} is not null) <> (${t.location} is not null)`,
    ),
    check("sponsored_listings_window_check", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type PandalRow = typeof pandals.$inferSelect;
export type NewPandal = typeof pandals.$inferInsert;
export type PhotoRow = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
export type ReportRow = typeof reports.$inferSelect;
export type MoryaRow = typeof moryas.$inferSelect;
export type VisitRow = typeof visits.$inferSelect;
export type PhotoLikeRow = typeof photoLikes.$inferSelect;
export type SponsoredListingRow = typeof sponsoredListings.$inferSelect;
