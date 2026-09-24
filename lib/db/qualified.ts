import { getTableName, sql, type Column, type SQL } from "drizzle-orm";

/**
 * 🔴 W2-Q01: AN OUTER COLUMN, SPELLED WITH ITS TABLE, WHEREVER IT IS USED.
 *
 * Drizzle renders a column interpolated into a `sql` template as `"table"."column"`
 * almost everywhere. The exception is the one that matters: a template that is a
 * SELECT field (or a RETURNING field) of a query with no join gets its columns
 * rendered bare, as `"column"`. Inside a correlated subquery a bare name binds to
 * the INNERMOST table that has a column of that name, so
 *
 *     (SELECT count(*) FROM users u WHERE u.organization_id = ${organizations.id})
 *
 * selected from `organizations` alone runs as `u.organization_id = "id"`, which is
 * `u.organization_id = u.id`, and counts nothing. Nothing throws; the figure is
 * just wrong. Adding a join to the outer query, or removing one, flips it.
 *
 * `qualified(organizations.id)` always renders `"organizations"."id"`, whatever
 * the query around it looks like, so a subquery means the outer row it names.
 * `npm run verify:qualified` refuses an outer column in a subquery without it.
 *
 * An aliased table (`alias(users, "u2")`) is named by its alias, because that is
 * the name the outer FROM gave it.
 */
export function qualified(column: Column): SQL {
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
}
