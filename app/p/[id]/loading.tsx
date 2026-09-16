import SubpageHeader from "@/components/SubpageHeader";

export default function Loading() {
  return (
    <main className="min-h-dvh bg-paper">
      <SubpageHeader />
      <div className="mx-auto max-w-md px-gutter pt-5">
        <div className="skeleton aspect-[4/3] w-full rounded-2xl" />
        <div className="skeleton mt-5 h-9 w-3/4 rounded-lg" />
        <div className="skeleton mt-3 h-4 w-1/2 rounded" />
        <div className="skeleton mt-5 h-12 w-full rounded-full" />
        <div className="skeleton mt-5 h-20 w-full rounded-xl" />
        <p role="status" className="sr-only">Loading the mandapam</p>
      </div>
    </main>
  );
}
