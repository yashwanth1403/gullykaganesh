import SubpageHeader from "@/components/SubpageHeader";
import Icon from "@/components/Icon";

/**
 * Shown while the server checks who is signed in. Mirrors the shape of the
 * signed-in form so nothing jumps when the real page lands; the masthead is
 * identical to the page's so it never flickers.
 */
export default function AddLoading() {
  return (
    <main className="min-h-dvh bg-paper" aria-busy>
      <SubpageHeader />

      <div className="mx-auto max-w-md px-gutter pt-6 pb-10">
        {/* One orchestrated moment: the pin drops, then the page fills in. */}
        <div className="flex items-center gap-3">
          <span className="relative grid h-11 w-11 place-items-center">
            <span className="animate-halo absolute inset-0 rounded-full bg-turmeric" />
            <span className="animate-drop relative grid h-9 w-9 place-items-center rounded-full bg-turmeric text-ink shadow-[var(--shadow-pin)]">
              <Icon name="pin" size={18} strokeWidth={2.2} />
            </span>
          </span>
          <div>
            <div className="skeleton h-7 w-44" />
            <div className="skeleton mt-2 h-3.5 w-60" />
          </div>
        </div>

        <p role="status" className="sr-only">Loading the add form</p>

        <div className="mt-8 space-y-7">
          <section>
            <div className="skeleton h-6 w-24" />
            <div className="skeleton mt-2 h-3.5 w-52" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="skeleton h-11 rounded-full" />
              <div className="skeleton h-11 rounded-full" />
            </div>
          </section>

          <section>
            <div className="skeleton h-6 w-28" />
            <div className="skeleton mt-3 aspect-[4/3] w-full" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="skeleton h-12" />
              <div className="skeleton h-12" />
            </div>
          </section>

          <section>
            <div className="skeleton h-6 w-40" />
            <div className="skeleton mt-3 h-12" />
            <div className="skeleton mt-3 h-12" />
          </section>
        </div>
      </div>
    </main>
  );
}
