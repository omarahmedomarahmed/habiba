/**
 * 🔴 EVERY COLUMN NAME IN RAW SQL, CHECKED AGAINST THE REAL SCHEMA.
 *
 * ## The bug this exists because of
 *
 * `failedAttemptsFor` asked `enrolment_attestations` for `consumed_at IS NULL`.
 * That table has `answered_at`. It has never had a `consumed_at`. So
 * `/sponsor/integrations` threw `column "consumed_at" does not exist` on every
 * single render and was a hard 500 for every company admin from the day it
 * shipped — on the portal that is the second most important surface in the
 * product.
 *
 * ## Why nothing caught it
 *
 * It is raw SQL inside a `sql` template literal. Drizzle types the query
 * builder; it cannot see inside a template string. So `tsc` passed, the schema
 * check passed, and all 28 gates passed over a page that could not load. Raw
 * SQL is the one place in this repo where the compiler offers no cover, and
 * this is what that costs.
 *
 * ## What it does
 *
 * Finds every raw `sql` template in the repo, works out which tables it reads,
 * and checks every identifier in it that looks like a column against
 * `information_schema`. A name that matches no column of any table the query
 * touches is a query that will throw the moment it runs.
 *
 * It reads the live schema rather than `schema.ts`, because the question is
 * not "did we declare it" but "is it there".
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

import { sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";

/* Words that appear in SQL and are not columns. */
const SQL_WORDS = new Set([
  "select", "from", "where", "and", "or", "not", "null", "is", "as", "on", "in",
  "join", "left", "right", "inner", "outer", "group", "by", "order", "having",
  "limit", "offset", "insert", "into", "values", "update", "set", "delete",
  "count", "sum", "avg", "min", "max", "coalesce", "now", "interval", "case",
  "when", "then", "else", "end", "distinct", "union", "all", "exists", "asc",
  "desc", "with", "recursive", "returning", "conflict", "do", "nothing",
  "true", "false", "cast", "int", "text", "boolean", "timestamp", "date",
  "numeric", "jsonb", "uuid", "array", "any", "between", "like", "ilike",
  "filter", "over", "partition", "lateral", "using", "cross", "full", "only",
  "current_date", "current_timestamp", "extract", "epoch", "day", "days",
  "month", "year", "hour", "minute", "second", "to_char", "date_trunc",
  "generate_series", "unnest", "string_agg", "array_agg", "jsonb_agg", "nullif",
  "greatest", "least", "abs", "round", "floor", "ceil", "length", "lower",
  "upper", "trim", "substring", "position", "replace", "concat", "left_join",
  "information_schema", "pg_catalog", "public", "constraint", "primary", "key",
  "foreign", "references", "index", "table", "column", "alter", "add", "drop",
  "create", "if", "exists_", "begin", "commit", "rollback", "for", "share",
  "nowait", "skipped", "locked", "skip", "of", "setval", "nextval", "currval",
]);

type Finding = { file: string; line: number; table: string[]; unknown: string[]; snippet: string };

async function main() {
  /*
   * Product code only. `scripts/` is full of WHERE-clause fragments whose
   * subject table is named by the query builder around them, not inside the
   * template — and every one of them runs on every gate, so a broken column
   * there announces itself within the hour. The code that cannot announce
   * itself is the code that renders a page.
   */
  const files = execSync(
    `grep -rl "sql\\\`" app lib --include=*.ts --include=*.tsx || true`,
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);

  /* The real schema, from the database rather than from our declaration of it. */
  const columns = await controlDb.execute(sql`
    SELECT table_name, column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'`);
  const byTable = new Map<string, Set<string>>();
  const everyColumn = new Set<string>();
  for (const row of columns.rows as { table_name: string; column_name: string }[]) {
    if (!byTable.has(row.table_name)) byTable.set(row.table_name, new Set());
    byTable.get(row.table_name)!.add(row.column_name);
    everyColumn.add(row.column_name);
  }

  const findings: Finding[] = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    /* Every sql`…` template, including nested backticks in ${} we do not care about. */
    const templates = [...text.matchAll(/sql`([\s\S]*?)`/g)];

    for (const match of templates) {
      const body = match[1];

      /*
       * Whole statements only.
       *
       * A fragment like ``sql`ticket_id IN (SELECT id FROM support_tickets …)` ``
       * names `support_tickets` but `ticket_id` belongs to whatever table the
       * query builder wrapped around it, which is not in the string. Judging a
       * fragment against the tables it happens to mention produces nothing but
       * false alarms, and a check that cries wolf is a check nobody runs.
       */
      if (!/^\s*(select|insert|update|delete|with)\b/i.test(body)) continue;

      const tables = [...body.matchAll(/\b(?:from|join|into|update)\s+([a-z_][a-z0-9_]*)/gi)]
        .map((m) => m[1].toLowerCase())
        .filter((t) => byTable.has(t));
      if (tables.length === 0) continue;

      const known = new Set<string>();
      for (const t of tables) for (const c of byTable.get(t)!) known.add(c);

      /*
       * Identifiers that look like columns: snake_case words, not SQL keywords,
       * not the table names themselves, not inside a ${} interpolation.
       */
      const withoutParams = body
        .replace(/\$\{[^}]*\}/g, " ? ")
        /* `… AS user_id` names a result, not a column of anything. */
        .replace(/\bas\s+[a-z_][a-z0-9_]*/gi, " ")
        /* A CTE's name is not a column either. */
        .replace(/\bwith\s+[a-z_][a-z0-9_]*/gi, " ");
      const words = [...withoutParams.matchAll(/\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/g)].map((m) => m[1]);

      const unknown = [...new Set(words)].filter(
        (w) =>
          !SQL_WORDS.has(w) &&
          !known.has(w) &&
          !byTable.has(w) &&
          /*
           * Only flag a word that IS a column somewhere in the database, or
           * that ends in a column-ish suffix. Anything else is far more likely
           * to be a function or an alias than a typo, and a check that cries
           * wolf is a check nobody runs.
           */
          (everyColumn.has(w) || /_(at|id|by|hash|cents|status|name|url|count|key)$/.test(w)),
      );

      if (unknown.length > 0) {
        const line = text.slice(0, match.index).split("\n").length;
        findings.push({
          file,
          line,
          table: tables,
          unknown,
          snippet: body.replace(/\s+/g, " ").trim().slice(0, 140),
        });
      }
    }
  }

  console.log(`raw SQL templates checked across ${files.length} files`);
  if (findings.length === 0) {
    console.log("ok  every column named in raw SQL exists on a table that query reads");
    process.exit(0);
  }

  console.log(`\n${findings.length} raw SQL statement(s) name a column that is not on any table they read:\n`);
  for (const f of findings) {
    console.log(`  ${f.file}:${f.line}`);
    console.log(`    reads:   ${f.table.join(", ")}`);
    console.log(`    unknown: ${f.unknown.join(", ")}`);
    console.log(`    sql:     ${f.snippet}\n`);
  }
  process.exit(1);
}

void main();
