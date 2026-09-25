/**
 * Whether a string is a uuid, before it goes near a uuid column.
 *
 * 🔴 TE56 — an id from a URL goes into `eq()` on a uuid column, and Postgres
 * answers `/patients/not-a-uuid` with `invalid input syntax for type uuid`,
 * which the portal's error boundary shows as "Something went wrong" instead
 * of the 404 the same URL with a well-formed stranger's id gets. A reader
 * that takes an id from a URL asks this first and returns "not found".
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
