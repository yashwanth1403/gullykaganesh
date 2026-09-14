import AddPandalForm from "@/components/AddPandalForm";
import SignIn from "@/components/SignIn";
import SubpageHeader from "@/components/SubpageHeader";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";

export const metadata = { title: "Add a mandapam — GullyKaGanesh" };

export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const [user, { error, next }] = await Promise.all([getCurrentUser(), searchParams]);
  // Where to land after sign-in — a pandal you were about to say Morya to,
  // for instance. Same-origin paths only; the callback checks again.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/add";

  return (
    <main className="min-h-dvh bg-paper">
      <SubpageHeader />

      <div className="mx-auto max-w-md px-gutter pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        {user ? (
          <>
            <h1 className="display text-[34px] text-ink">Add a mandapam</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">
              It goes on the map the moment you tap the button — as {user.displayName}.
            </p>
            {/* Phones get passed around during the festival; make switching accounts one tap. */}
            <form action={signOut.bind(null, "/add")} className="mt-1.5">
              <button
                type="submit"
                className="numeric rounded-full text-[11px] uppercase tracking-[0.08em] text-kumkum underline decoration-kumkum/40 underline-offset-4 transition-opacity duration-150 ease-out hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric active:opacity-50"
              >
                Not {user.displayName}? Sign out
              </button>
            </form>
            <div className="mt-7">
              <AddPandalForm />
            </div>
          </>
        ) : (
          <>
            <h1 className="display text-[34px] text-ink">Add your gully&apos;s Ganesh</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-dim">
              Sign in once, then it&apos;s photos, a pin on the map, and a name. Your
              name goes on the mandapam you add.
            </p>
            {error === "signin" && (
              <p role="alert" className="mt-4 rounded-xl border border-kumkum/40 bg-kumkum/8 px-3.5 py-3 text-[13.5px] text-kumkum">
                Sign-in didn&apos;t complete. Try again.
              </p>
            )}
            <div className="mt-7">
              <SignIn next={safeNext} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
