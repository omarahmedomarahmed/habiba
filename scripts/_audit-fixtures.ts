import { sql, type SQL } from "drizzle-orm";

/**
 * 🔴 0184: THE ONE WAY A SCRIPT REMOVES THE AUDIT ROWS ITS OWN FIXTURES WROTE.
 *
 * `audit_log` refuses UPDATE and DELETE (drizzle/0184), except emptying an
 * actor column and deleting a row past six years. A verifier that invents a
 * practice, acts in it and then tidies up needs a third door, and this is it:
 * `app.audit_fixtures` set to `on` for the one statement's own transaction.
 *
 * Put it in the WHERE of the statement that deletes, ANDed with the real
 * condition. It is an uncorrelated subquery, so Postgres evaluates it once,
 * before the first row is touched, and the trigger then sees the setting. It
 * is `set_config(..., true)`: local to the transaction, gone when the statement
 * ends, so it cannot leak into the next query on a pooled connection.
 *
 * 🔴 It lives under scripts/ and nowhere else. tests/safety.test.ts fails if
 * `app.audit_fixtures` appears in any file under app/, lib/ or components/,
 * which is what lets /hipaa say the product cannot rewrite its audit log.
 */
export function auditFixtures(): SQL {
  return sql`(SELECT set_config('app.audit_fixtures', 'on', true)) = 'on'`;
}
