import { notFound } from "next/navigation";
import AddPandalForm from "@/components/AddPandalForm";
import ClaimPanel from "@/components/ClaimPanel";
import DeleteButton from "@/components/DeleteButton";
import SignIn from "@/components/SignIn";
import SubpageHeader from "@/components/SubpageHeader";
import UnclaimButton from "@/components/UnclaimButton";
import VerifyHeightButton from "@/components/VerifyHeightButton";
import { getCurrentUser } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { getPandalForManage } from "@/lib/queries";
import { signOut } from "@/app/auth/actions";

export const metadata = { title: "Edit or claim", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One door for everything that changes a pandal after it's on the map. The
 * map page is cached for everyone and never knows who is looking, so the
 * "Edit or claim" link on every card lands here and this page sorts it out:
 * sign in, edit, or claim.
 */
export default async function ManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [user, pandal] = await Promise.all([getCurrentUser(), getPandalForManage(id)]);
  if (!pandal || pandal.status === "removed") notFound();

  const here = `/p/${pandal.id}/manage`;

  return (
    <main className="min-h-dvh bg-paper">
      <SubpageHeader />
      <div className="mx-auto max-w-md px-gutter pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        {!user ? (
          <>
            <h1 className="display text-[34px] leading-[1.05] text-ink">Sign in to edit or claim</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-dim">
              {pandal.name}, {pandal.area}. If you added it, or you run it, sign in and
              it&apos;s yours to edit.
            </p>
            <div className="mt-7">
              <SignIn next={here} />
            </div>
          </>
        ) : canEdit(user, pandal) ? (
          <>
            <h1 className="display text-[34px] leading-[1.05] text-ink">Edit {pandal.name}</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">
              Changes show on the map the moment you save — as {user.displayName}.
            </p>
            <form action={signOut.bind(null, here)} className="mt-1.5">
              <button
                type="submit"
                className="numeric rounded-full text-[11px] uppercase tracking-[0.08em] text-kumkum underline decoration-kumkum/40 underline-offset-4 transition-opacity duration-150 ease-out hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric active:opacity-50"
              >
                Not {user.displayName}? Sign out
              </button>
            </form>
            {pandal.status === "hidden" && (
              <p role="status" className="mt-4 rounded-xl border border-kumkum/40 bg-kumkum/8 px-3.5 py-3 text-[13.5px] leading-relaxed text-kumkum">
                This mandapam is off the map while we check a report. You can still edit it;
                it comes back once the report is reviewed.
              </p>
            )}
            {/* Admin-only: the one field the owner must not set for themselves. */}
            {user.isAdmin && (
              <div className="mt-5">
                <VerifyHeightButton
                  pandalId={pandal.id}
                  heightFt={pandal.heightFt}
                  verified={pandal.heightVerified}
                />
              </div>
            )}
            <div className="mt-7">
              <AddPandalForm initial={pandal} />
            </div>
            {/* The quiet, destructive things live well below Save. */}
            <div className="mt-10 space-y-4 border-t border-line pt-6 text-center">
              {pandal.claimedBy === user.id && <UnclaimButton pandalId={pandal.id} />}
              <div>
                <DeleteButton pandalId={pandal.id} name={pandal.name} />
              </div>
            </div>
          </>
        ) : (
          <>
            <h1 className="display text-[34px] leading-[1.05] text-ink">{pandal.name}</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">
              {pandal.gully}, {pandal.area}
            </p>
            <div className="mt-7">
              <ClaimPanel pandalId={pandal.id} claimedByName={pandal.claimedByName} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
