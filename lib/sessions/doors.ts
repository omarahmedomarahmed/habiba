/**
 * 🔴 W2-P06: what one of a patient's sessions opens, as arithmetic.
 *
 * Pure, and outside `lib/data`, so the four states and the dead ends between
 * them are a test and the client list can import the type without pulling a
 * database module into the browser. `sessionDoors` in `lib/data/patient-view.ts`
 * reads the rows and asks this.
 */
export type SessionDoor = { kind: "join" | "pay" | "checking" | "summary"; href: string };

/**
 * 🔴 Board 729: A BOOKED HOUR NOBODY STARTED IS OVER WHEN THE HOUR IS.
 *
 * A booking's join link lives four hours past its start (so a late clinician
 * can still be met), and the patient's app read the link alone: a covered
 * session at 08:00 that never took place still offered "Join", "Your
 * therapist is still writing your summary" and "Joining shortly" at 10:26.
 * Bookings are one-hour slots; once that hour has passed and nobody started
 * it, it did not take place, and nothing on the patient's side says otherwise.
 * A session already under way is never missed, however long it runs.
 */
export const BOOKED_HOUR_MS = 60 * 60_000;

export function missedBooking(
  row: { status: string; scheduledAt: Date | null; startedAt: Date | null },
  now: number,
): boolean {
  return (
    row.status === "scheduled" &&
    row.startedAt === null &&
    row.scheduledAt !== null &&
    row.scheduledAt.getTime() + BOOKED_HOUR_MS <= now
  );
}

export function doorFor(row: {
  status: string;
  /** Board 729: with `startedAt`, a missed booking has no door. Absent reads as unbooked. */
  scheduledAt?: Date | null;
  startedAt?: Date | null;
  endedAt: Date | null;
  joinToken: string | null;
  joinTokenExpiresAt: Date | null;
  priceCents: number;
  paymentStatus: string;
  transferSubmitted: boolean;
  summarySigned: boolean;
  now: number;
}): SessionDoor | null {
  if (row.status === "cancelled") return null;
  if (missedBooking({ status: row.status, scheduledAt: row.scheduledAt ?? null, startedAt: row.startedAt ?? null }, row.now)) {
    return null;
  }

  const open =
    (row.status === "scheduled" || row.status === "in_progress") &&
    row.endedAt === null &&
    row.joinToken !== null &&
    (row.joinTokenExpiresAt === null || row.joinTokenExpiresAt.getTime() > row.now);

  if (open) {
    const owes = row.priceCents > 0 && row.paymentStatus === "pending";
    if (!owes) return { kind: "join", href: `/join/${row.joinToken}` };
    /* The pay page shows the transfer's state itself; the card says which it is. */
    return { kind: row.transferSubmitted ? "checking" : "pay", href: `/pay/${row.joinToken}` };
  }

  /* No door for a cancelled session, an expired link, or a summary nobody signed. */
  return row.summarySigned ? { kind: "summary", href: "/patient/summary" } : null;
}
