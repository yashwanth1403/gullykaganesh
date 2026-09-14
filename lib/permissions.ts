/**
 * Who may change a pandal. Two owners by design: the person who uploaded it
 * (they took the photos) and the person who claimed it (they run the
 * mandapam). Admins can do everything. Every server action that writes to a
 * pandal goes through this — the UI only decides what to show.
 */
export function canEdit(
  user: { id: string; isAdmin: boolean },
  pandal: { submittedBy: string | null; claimedBy: string | null },
): boolean {
  return user.isAdmin || user.id === pandal.submittedBy || user.id === pandal.claimedBy;
}
