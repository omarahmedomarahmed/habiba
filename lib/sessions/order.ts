/**
 * 🔴 Board 374: a patient's sessions, in the order a person reads them.
 *
 * What is coming runs soonest first; what is past, latest first. The data
 * arrives latest first for every group (the past lists want that), so the
 * Booked list read Mon 28 10:00, Sun 27 11:00, Sun 27 10:00, with the next
 * session at the bottom. Pure, so the order is a test.
 */
export type OrderGroup = "today" | "upcoming" | "past_scheduled" | "past_instant";

export function sortForGroup<T extends { at: Date }>(group: OrderGroup, rows: T[]): T[] {
  const ahead = group === "today" || group === "upcoming";
  return [...rows].sort((a, b) => (ahead ? a.at.getTime() - b.at.getTime() : b.at.getTime() - a.at.getTime()));
}
