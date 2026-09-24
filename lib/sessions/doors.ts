/**
 * 🔴 W2-P06: what one of a patient's sessions opens, as arithmetic.
 *
 * Pure, and outside `lib/data`, so the four states and the dead ends between
 * them are a test and the client list can import the type without pulling a
 * database module into the browser. `sessionDoors` in `lib/data/patient-view.ts`
 * reads the rows and asks this.
 */
export type SessionDoor = { kind: "join" | "pay" | "checking" | "summary"; href: string };

export function doorFor(row: {
  status: string;
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
