-- PostGIS must exist before any geometry column. Hand-added: drizzle-kit does
-- not manage extensions. Also hand-edited: geometry(Point, 4326) — drizzle-kit
-- 0.31 drops the SRID from the DDL. Drizzle inserts SRID-less WKT, which
-- PostGIS stamps with the column SRID, so reads and writes still round-trip.
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('live', 'hidden', 'removed');--> statement-breakpoint
CREATE TABLE "pandals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"gully" text NOT NULL,
	"area" text NOT NULL,
	"location" geometry(Point, 4326) NOT NULL,
	"height_ft" integer,
	"visarjan_day" smallint NOT NULL,
	"landmark" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"status" "content_status" DEFAULT 'live' NOT NULL,
	"submitted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pandals_visarjan_day_check" CHECK ("pandals"."visarjan_day" in (1, 3, 5, 7, 9, 11))
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pandal_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"status" "content_status" DEFAULT 'live' NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photos_r2Key_unique" UNIQUE("r2_key")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pandal_id" uuid,
	"photo_id" uuid,
	"reporter_id" uuid,
	"reason" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_target_check" CHECK ("reports"."pandal_id" is not null or "reports"."photo_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "sponsored_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pandal_id" uuid,
	"location" geometry(Point, 4326),
	"business_name" text NOT NULL,
	"tagline" text,
	"url" text,
	"phone" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sponsored_listings_target_check" CHECK (("sponsored_listings"."pandal_id" is not null) <> ("sponsored_listings"."location" is not null)),
	CONSTRAINT "sponsored_listings_window_check" CHECK ("sponsored_listings"."ends_at" > "sponsored_listings"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "pandals" ADD CONSTRAINT "pandals_submitted_by_profiles_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_pandal_id_pandals_id_fk" FOREIGN KEY ("pandal_id") REFERENCES "public"."pandals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_pandal_id_pandals_id_fk" FOREIGN KEY ("pandal_id") REFERENCES "public"."pandals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsored_listings" ADD CONSTRAINT "sponsored_listings_pandal_id_pandals_id_fk" FOREIGN KEY ("pandal_id") REFERENCES "public"."pandals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pandals_location_gist" ON "pandals" USING gist ("location");--> statement-breakpoint
CREATE INDEX "pandals_submitted_by_idx" ON "pandals" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "photos_pandal_id_idx" ON "photos" USING btree ("pandal_id");--> statement-breakpoint
CREATE INDEX "sponsored_listings_location_gist" ON "sponsored_listings" USING gist ("location");