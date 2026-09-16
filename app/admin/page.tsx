import { notFound } from "next/navigation";
import ReportQueue from "@/components/admin/ReportQueue";
import SubpageHeader from "@/components/SubpageHeader";
import { getModerationQueue } from "@/lib/admin-queries";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Reports", robots: { index: false, follow: false } };

/**
 * The other half of live-then-report moderation. Admins are flagged by hand
 * in SQL (`update profiles set is_admin = true where id = …`); everyone else
 * gets the same 404 as a route that doesn't exist.
 */
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();

  const { open, hidden } = await getModerationQueue();

  return (
    <main className="min-h-dvh bg-paper">
      <SubpageHeader />
      <div className="mx-auto max-w-md px-gutter pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <h1 className="display text-[34px] leading-[1.05] text-ink">Reports</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">
          Three people flag something and it hides itself. You decide what happens next.
        </p>
        <div className="mt-7">
          <ReportQueue open={open} hidden={hidden} />
        </div>
      </div>
    </main>
  );
}
