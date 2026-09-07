/**
 * The C93 rule, made checkable. PLAN.md 21R.9.
 *
 * ## The rule
 *
 * A verifier does not read published content itself. It asks
 * `withPublishedContent`, whose body does not run when the content is absent —
 * so a check that reads content **cannot** be written outside a deferral,
 * because the rows are not in scope out there.
 *
 * This module finds the one way back in: a `.from(contentPages)` read written
 * by hand inside a verifier. That is exactly what sprints 18R and 19 did,
 * three weeks after C90 ruled that content checks are skipped with a reason
 * rather than failed, and it is how a whole gate goes red the moment sprint 22
 * purges the database.
 *
 * ## The one legitimate exception
 *
 * A **control**: a row the verifier planted itself, read back to prove a scan
 * can see what is stored (17.10 does this with the sentence C60 shipped).
 * Those rows are the file's own fixture, not published content, and they are
 * recognised by the `verify…` slug the fixture carries.
 *
 * 🔴 **Comments are stripped before anything is scanned.** Five checkers in
 * this repository have matched their own documentation — including one in
 * sprint 19 that matched the phrase "two languages" in a file that does
 * nothing of the kind. A file that *explains* the rule in prose must neither
 * satisfy it nor violate it.
 */

/** Comments out, string bodies kept — a check's label is part of the code. */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

export type ContentRead = {
  /** The statement, collapsed to one line, so a failure names the offender. */
  statement: string;
  /** A control reads back a fixture the file planted itself. */
  control: boolean;
};

/**
 * Every hand-written read of the content table in one verifier's source.
 *
 * The statement is bounded the way a person reads one: back to the assignment
 * or `await` that starts it, forward to the semicolon that ends it.
 */
export function contentReads(rawSource: string): ContentRead[] {
  const source = stripComments(rawSource);
  const reads: ContentRead[] = [];
  const pattern = /\.from\(\s*contentPages\s*\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    const before = source.slice(0, match.index);
    const start = Math.max(
      before.lastIndexOf("const "),
      before.lastIndexOf("await "),
      before.lastIndexOf("return "),
    );
    const semicolon = source.indexOf(";", match.index);
    const statement = source
      .slice(start === -1 ? match.index : start, semicolon === -1 ? match.index + 200 : semicolon)
      .replace(/\s+/g, " ")
      .trim();

    reads.push({ statement, control: /verify\d*-?control|"verify/i.test(statement) });
  }

  return reads;
}

/** The offenders: content reads that are not a control the file planted. */
export function undeferredContentReads(rawSource: string): string[] {
  return contentReads(rawSource)
    .filter((read) => !read.control)
    .map((read) => read.statement.slice(0, 120));
}
