CREATE TYPE "public"."media_kind" AS ENUM('photo', 'video');--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "kind" "media_kind" DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "poster_key" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "duration_s" smallint;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_video_has_poster" CHECK ("photos"."kind" <> 'video' or "photos"."poster_key" is not null);