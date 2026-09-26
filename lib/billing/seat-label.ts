/**
 * 🔴 Board 268: a seat bill's line, read back into its parts so the screen can
 * say it in the reader's language and with the right form of each count.
 *
 * The description is stored as English arithmetic ("1 seats from 0, for the 5
 * days left of this month") and was printed as stored, so a clinic read "1
 * seats" in either language. The stored text stays as it is: the monthly seat
 * run matches on it (`started_this_month` in lib/billing/service.ts) and old
 * rows carry it. This only parses it; anything it does not recognise is shown
 * as stored.
 *
 * Pure, so the shapes are a test.
 */
export type SeatBillLabel =
  | { kind: "change"; toSeats: number; fromSeats: number; days: number }
  | { kind: "month"; seats: number }
  | { kind: "planMonth"; plan: string; seats: number };

export function parseSeatBill(description: string): SeatBillLabel | null {
  const change = /^(\d+) seats from (\d+), for the (\d+) days left of this month$/.exec(description);
  if (change) {
    return { kind: "change", toSeats: Number(change[1]), fromSeats: Number(change[2]), days: Number(change[3]) };
  }
  const month = /^Seats, (\d+), monthly$/.exec(description);
  if (month) return { kind: "month", seats: Number(month[1]) };
  const plan = /^(.+), (\d+) seats, monthly$/.exec(description);
  if (plan) return { kind: "planMonth", plan: plan[1]!, seats: Number(plan[2]) };
  return null;
}
