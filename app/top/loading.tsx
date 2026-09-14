import SubpageHeader from "@/components/SubpageHeader";

export default function Loading() {
  return (
    <main className="min-h-dvh bg-paper">
      <SubpageHeader />
      <div className="mx-auto max-w-md px-gutter pt-6">
        <div className="skeleton h-9 w-2/3 rounded-lg" />
        <div className="skeleton mt-3 h-4 w-1/2 rounded" />
        <div className="skeleton mt-8 h-52 w-full rounded-2xl" />
        <div className="skeleton mt-6 h-14 w-full rounded-xl" />
        <div className="skeleton mt-2 h-14 w-full rounded-xl" />
      </div>
    </main>
  );
}
