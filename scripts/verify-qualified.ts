/**
 * 🔴 W2-Q01: NO OUTER COLUMN INSIDE A SUBQUERY WITHOUT ITS TABLE.
 *
 *   npm run verify:qualified
 *
 * ## The class this closes
 *
 * Drizzle renders `${organizations.id}` in a `sql` template as
 * `"organizations"."id"` everywhere except one place: a SELECT (or RETURNING)
 * field of a query with no join, where it renders a bare `"id"`. Put that inside
 * a correlated subquery and Postgres binds the bare name to the innermost table
 * that has such a column, so the subquery compares a row with itself:
 *
 *   - `webhooksFor` (fixed in 29a880dc): `d.webhook_id = d.id`, Failing never shown;
 *   - the operator board's clinics: `u.organization_id = u.id`, 0 clinicians,
 *     0 live seats and 0 due on every clinic;
 *   - the operator board's people: `pa.person_id = pa.person_id`, every
 *     patient counted as claimed the moment one account exists;
 *   - traction: `s.therapist_id = s.id`, 0 activated clinicians.
 *
 * None of them threw. Each was a figure that looked like a figure, and adding or
 * removing a join to the outer query flips the rendering either way, so the
 * shape is only safe when the outer column says which table it is.
 *
 * ## The rule
 *
 * Inside a parenthesised SELECT in a `sql` template (a subquery, EXISTS, IN,
 * a scalar subquery), a schema column may be interpolated bare only when its
 * own table is interpolated into that same SELECT (`FROM ${copilotMessages}`),
 * which makes it the inner row's column and the bare name binds to it. Any
 * other column is an outer one and goes through `qualified()` from
 * `lib/db/qualified.ts`, whether or not today's outer query has a join.
 *
 * Source only, no database. The control plants the offending shape and must
 * see it caught, so a scan that stopped matching cannot pass quietly.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

import { readSource, reporter } from "./_verify";

const { check, finish } = reporter();

/** Every table `lib/db/schema.ts` exports, by its exported name. */
function schemaTables(): Set<string> {
  const source = readSource("lib/db/schema.ts");
  return new Set([...source.matchAll(/export const (\w+)\s*=\s*pgTable\(/g)].map((m) => m[1]));
}

type Finding = { file: string; line: number; column: string };

/**
 * One file's outer columns in subqueries. The controls below run it on a
 * planted source exactly as on a real one.
 */
function scan(file: string, source: string, tables: Set<string>): Finding[] {
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  /* Local names that mean a schema table in this file: named imports (renamed or not) and `schema.x`. */
  const local = new Map<string, string>();
  const namespaces = new Set<string>();
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const from = (statement.moduleSpecifier as ts.StringLiteral).text;
    if (!/(^|\/)db\/schema$|^\.\/schema$/.test(from)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings) continue;
    if (ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
    else
      for (const el of bindings.elements) {
        const exported = (el.propertyName ?? el.name).text;
        if (tables.has(exported)) local.set(el.name.text, exported);
      }
  }
  if (/\bschema\b/.test(source)) namespaces.add("schema");
  /* `const { users } = schema` and `const { users } = await import("../lib/db/schema")`. */
  const destructured = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      /\bschema\b/.test(node.initializer.getText(sf))
    )
      for (const el of node.name.elements) {
        const exported = (el.propertyName ?? el.name).getText(sf);
        if (ts.isIdentifier(el.name) && tables.has(exported)) local.set(el.name.text, exported);
      }
    ts.forEachChild(node, destructured);
  };
  destructured(sf);

  /** The table an expression names, if it names one: `users`, `schema.users`. */
  const tableOf = (e: ts.Expression): string | null => {
    if (ts.isIdentifier(e)) return local.has(e.text) ? e.text : null;
    if (
      ts.isPropertyAccessExpression(e) &&
      ts.isIdentifier(e.expression) &&
      namespaces.has(e.expression.text) &&
      tables.has(e.name.text)
    )
      return e.getText(sf);
    return null;
  };

  const findings: Finding[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isTaggedTemplateExpression(node) &&
      /^sql(<[\s\S]*>)?$/.test(node.tag.getText(sf)) &&
      ts.isTemplateExpression(node.template)
    ) {
      const literals = [node.template.head.text, ...node.template.templateSpans.map((s) => s.literal.text)];
      const spans = node.template.templateSpans.map((s) => s.expression);

      type Group = { select: boolean; tables: Set<string> };
      /* The template itself is a group: a whole statement when it starts with SELECT or WITH. */
      const stack: Group[] = [{ select: /^\s*\(?\s*(select|with)\b/i.test(literals[0]), tables: new Set() }];
      const nearestSelect = () => [...stack].reverse().find((g) => g.select);
      const pending: { expr: ts.Expression; group: Group | undefined }[] = [];

      literals.forEach((text, i) => {
        let quoted = false;
        for (let c = 0; c < text.length; c++) {
          const ch = text[c];
          if (ch === "'") quoted = !quoted;
          if (quoted) continue;
          if (ch === "(") stack.push({ select: /^\s*select\b/i.test(text.slice(c + 1)), tables: new Set() });
          else if (ch === ")" && stack.length > 1) stack.pop();
        }
        if (i >= spans.length) return;
        const expr = spans[i];
        const group = nearestSelect();
        const table = tableOf(expr);
        if (table && group) group.tables.add(table);
        else pending.push({ expr, group });
      });

      for (const { expr, group } of pending) {
        if (!group || !ts.isPropertyAccessExpression(expr)) continue;
        const table = tableOf(expr.expression);
        if (!table || group.tables.has(table)) continue;
        const { line } = sf.getLineAndCharacterOfPosition(expr.getStart(sf));
        findings.push({ file, line: line + 1, column: expr.getText(sf) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

function sourcesUnder(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourcesUnder(path, out);
    else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

function main() {
  const tables = schemaTables();
  check("the schema's tables were read", tables.size > 50, `${tables.size} tables`);

  const files = [...sourcesUnder("lib"), ...sourcesUnder("app")];
  const findings = files.flatMap((file) => scan(file, readSource(file), tables));
  check(
    "🔴 W2-Q01 every outer column inside a subquery is qualified()",
    findings.length === 0,
    findings.length === 0
      ? `${files.length} files`
      : findings.map((f) => `${f.file}:${f.line} ${f.column}`).join("; "),
  );

  /* ---------------------------------------------------------- the controls -- */

  const planted = (body: string) =>
    scan(
      "planted.ts",
      `import { sql } from "drizzle-orm";\nimport { organizations, users } from "@/lib/db/schema";\n${body}`,
      tables,
    );

  const bare = planted(
    "const x = sql`(SELECT count(*)::int FROM users u WHERE u.organization_id = ${organizations.id})`;",
  );
  check(
    "🔴 W2-Q01 CONTROL, a bare outer column in a scalar subquery is caught",
    bare.length === 1 && bare[0].column === "organizations.id",
    JSON.stringify(bare),
  );

  const exists = planted(
    "const x = sql`COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = ${users.id}))`;",
  );
  check(
    "🔴 W2-Q01 CONTROL, and one in an EXISTS inside a FILTER",
    exists.length === 1,
    JSON.stringify(exists),
  );

  const renamed = scan(
    "planted.ts",
    'import { sql } from "drizzle-orm";\nimport { users as u } from "@/lib/db/schema";\nconst x = sql`EXISTS (SELECT 1 FROM t WHERE t.user_id = ${u.id})`;',
    tables,
  );
  check("🔴 W2-Q01 CONTROL, and one through a renamed import", renamed.length === 1, JSON.stringify(renamed));

  const fine = planted(
    [
      "const a = sql`(SELECT count(*)::int FROM users u WHERE u.organization_id = ${qualified(organizations.id)})`;",
      "const b = sql`(SELECT count(*)::int FROM ${users} WHERE ${users.organizationId} = ${qualified(organizations.id)})`;",
      "const c = sql`${users.id} IN (SELECT id FROM t)`;",
      "const d = sql`${users.status} = 'active' AND ${users.id} = ${'(select'}`;",
    ].join("\n"),
  );
  check(
    "W2-Q01 CONTROL, qualified outer columns, inner columns of an interpolated table, and columns outside the subquery pass",
    fine.length === 0,
    JSON.stringify(fine),
  );

  finish("W2-Q01 qualified");
}

main();
