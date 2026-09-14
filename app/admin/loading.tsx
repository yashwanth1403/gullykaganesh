import SubpageHeader from "@/components/SubpageHeader";

export default function AdminLoading() {
  return (
    <main className="min-h-dvh bg-paper" aria-busy>
      <SubpageHeader />
      <div className="mx-auto max-w-md px-gutter pt-6 pb-10">
        <div className="skeleton h-9 w-40" />
        <div className="skeleton mt-3 h-3.5 w-72" />
        <p role="status" className="sr-only">Loading reports</p>
        <div className="mt-8 space-y-3">
          <div className="skeleton h-36 rounded-xl" />
          <div className="skeleton h-36 rounded-xl" />
        </div>
      </div>
    </main>
  );
}
