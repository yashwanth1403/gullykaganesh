ALTER TABLE "pandals" ADD COLUMN "claimed_by" uuid;--> statement-breakpoint
ALTER TABLE "pandals" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pandals" ADD CONSTRAINT "pandals_claimed_by_profiles_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pandals_claimed_by_idx" ON "pandals" USING btree ("claimed_by");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_open_pandal_reporter" ON "reports" USING btree ("pandal_id","reporter_id") WHERE "reports"."resolved_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "reports_open_photo_reporter" ON "reports" USING btree ("photo_id","reporter_id") WHERE "reports"."resolved_at" is null;