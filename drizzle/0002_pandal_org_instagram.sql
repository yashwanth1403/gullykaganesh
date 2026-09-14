ALTER TABLE "pandals" ADD COLUMN "organisation" text;--> statement-breakpoint
ALTER TABLE "pandals" ADD COLUMN "instagram_handle" text;--> statement-breakpoint
ALTER TABLE "pandals" ADD CONSTRAINT "pandals_instagram_handle_check" CHECK ("pandals"."instagram_handle" ~ '^[A-Za-z0-9._]{1,30}$');