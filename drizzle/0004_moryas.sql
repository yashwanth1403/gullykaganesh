CREATE TABLE "moryas" (
	"pandal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"weight" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moryas_pandal_id_user_id_pk" PRIMARY KEY("pandal_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "pandals" ADD COLUMN "morya_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "moryas" ADD CONSTRAINT "moryas_pandal_id_pandals_id_fk" FOREIGN KEY ("pandal_id") REFERENCES "public"."pandals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moryas" ADD CONSTRAINT "moryas_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moryas_user_id_idx" ON "moryas" USING btree ("user_id");--> statement-breakpoint

-- Same rule as every other table: RLS on, no policies, all access via Drizzle.
ALTER TABLE "moryas" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- pandals.morya_count is always sum(weight). Recomputed rather than nudged
-- ±1 so a partial failure or a hand-edited weight can never leave it drifting.
CREATE OR REPLACE FUNCTION public.sync_morya_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target uuid := COALESCE(NEW.pandal_id, OLD.pandal_id);
BEGIN
  UPDATE public.pandals
  SET morya_count = COALESCE(
    (SELECT sum(weight) FROM public.moryas WHERE pandal_id = target),
    0
  )
  WHERE id = target;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER moryas_sync_count
  AFTER INSERT OR UPDATE OR DELETE ON "moryas"
  FOR EACH ROW EXECUTE FUNCTION public.sync_morya_count();
