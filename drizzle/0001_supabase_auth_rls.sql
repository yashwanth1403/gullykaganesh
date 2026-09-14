-- Supabase-specific wiring that drizzle-kit cannot express because it only
-- manages the public schema.

-- profiles.id is the Supabase Auth user id. Deleting the auth user removes the
-- profile; pandals/photos they submitted survive with submitted_by = null.
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_id_auth_users_id_fk"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade;
--> statement-breakpoint

-- Create a profile row on signup. display_name comes from the OAuth provider
-- (Google sends `full_name`/`name`), falling back to the email local part.
-- SECURITY DEFINER so the trigger can write public.profiles from auth's context.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1),
      'Bhakt'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
--> statement-breakpoint

-- Every table Supabase exposes over PostgREST must have RLS on, or the anon key
-- can read and write it. All app access goes through Drizzle on the server
-- (postgres role, bypasses RLS), so enabling RLS with *no policies* makes the
-- REST/GraphQL endpoints deny everything. Add policies only if the browser
-- ever queries Supabase directly.
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "pandals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "photos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sponsored_listings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Keep updated_at honest without every write path remembering to set it.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER pandals_set_updated_at BEFORE UPDATE ON "pandals"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER sponsored_listings_set_updated_at BEFORE UPDATE ON "sponsored_listings"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
