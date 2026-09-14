import SubpageHeader from "@/components/SubpageHeader";

/** Shown while the server checks who is signed in and loads the pandal. */
export default function ManageLoading() {
  return (
    <main className="min-h-dvh bg-paper" aria-busy>
      <SubpageHeader />
      <div className="mx-auto max-w-md px-gutter pt-6 pb-10">
        <div className="skeleton h-9 w-56" />
        <div className="skeleton mt-3 h-3.5 w-72" />
        <p role="status" className="sr-only">Loading the mandapam</p>
        <div className="mt-8 space-y-7">
          <section>
            <div className="skeleton h-6 w-24" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="skeleton aspect-[4/5]" />
              <div className="skeleton aspect-[4/5]" />
              <div className="skeleton aspect-[4/5]" />
            </div>
          </section>
          <section>
            <div className="skeleton h-6 w-28" />
            <div className="skeleton mt-3 aspect-[4/3] w-full" />
          </section>
        </div>
      </div>
    </main>
  );
}
