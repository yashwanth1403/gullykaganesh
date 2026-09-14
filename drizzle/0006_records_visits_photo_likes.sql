CREATE TABLE "photo_likes" (
	"photo_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_likes_photo_id_user_id_pk" PRIMARY KEY("photo_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"pandal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"festival_day" smallint NOT NULL,
	"distance_m" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visits_pandal_id_user_id_festival_day_pk" PRIMARY KEY("pandal_id","user_id","festival_day")
);
--> statement-breakpoint
ALTER TABLE "pandals" ADD COLUMN "visit_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pandals" ADD COLUMN "height_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pandals" ADD COLUMN "established_year" smallint;--> statement-breakpoint
ALTER TABLE "pandals" ADD COLUMN "eco_friendly" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pandals" ADD COLUMN "theme" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "like_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "photo_likes" ADD CONSTRAINT "photo_likes_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_likes" ADD CONSTRAINT "photo_likes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_pandal_id_pandals_id_fk" FOREIGN KEY ("pandal_id") REFERENCES "public"."pandals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_likes_user_id_idx" ON "photo_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "visits_user_id_idx" ON "visits" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "pandals" ADD CONSTRAINT "pandals_established_year_check" CHECK ("pandals"."established_year" between 1800 and 2100);--> statement-breakpoint

-- Same rule as every other table: RLS on, no policies, all access via Drizzle.
ALTER TABLE "visits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "photo_likes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- pandals.visit_count is always count(visits). Recomputed, like morya_count.
CREATE OR REPLACE FUNCTION public.sync_visit_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target uuid := COALESCE(NEW.pandal_id, OLD.pandal_id);
BEGIN
  UPDATE public.pandals
  SET visit_count = (SELECT count(*) FROM public.visits WHERE pandal_id = target)
  WHERE id = target;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER visits_sync_count
  AFTER INSERT OR DELETE ON "visits"
  FOR EACH ROW EXECUTE FUNCTION public.sync_visit_count();
--> statement-breakpoint

-- photos.like_count is always count(photo_likes).
CREATE OR REPLACE FUNCTION public.sync_photo_like_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target uuid := COALESCE(NEW.photo_id, OLD.photo_id);
BEGIN
  UPDATE public.photos
  SET like_count = (SELECT count(*) FROM public.photo_likes WHERE photo_id = target)
  WHERE id = target;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER photo_likes_sync_count
  AFTER INSERT OR DELETE ON "photo_likes"
  FOR EACH ROW EXECUTE FUNCTION public.sync_photo_like_count();
