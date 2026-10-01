/**
 * DD-2: no shipped default page makes a claim that is false today, and the
 * guard that keeps a stale CMS row from making one is wired.
 *
 * Static: reads `defaults.ts`, `defaults-ar.ts` and source. The same list run
 * against the database rows is `verify:cms-claims`.
 *
 *     npm run -s verify:claims-defaults
 */
import { DEFAULT_PAGES } from "../lib/content/defaults";
import { DEFAULT_PAGES_AR } from "../lib/content/defaults-ar";
import { FORBIDDEN_CLAIMS, REQUIRED_STATEMENTS, claimStrings, forbiddenClaimsIn, guardedPage, pageClaims } from "../lib/content/claims";
import { reporter, readSource } from "./_verify";

const { check, finish } = reporter();

/* ------------------------------------------------------------ controls -- */

/* The sentences due diligence found live. Each must be caught (T2). */
const PLANTED: [string, unknown][] = [
  ["baa-included", [{ type: "faq", items: [{ q: "Is a BAA included?", a: "Yes, on every plan." }] }]],
  ["baa-included", [{ type: "prose", body: "Our subprocessors are covered by a business associate agreement." }]],
  ["region-on-request", [{ type: "prose", body: "A region inside your jurisdiction is available on request." }]],
  ["clinician-deletes-patient", [{ type: "prose", body: "Clinicians can export or delete a patient record." }]],
  ["clinician-deletes-patient", [{ type: "prose", body: "Clinical records are retained until deleted by the practice." }]],
  ["audit-nobody-can-edit", [{ type: "features", items: [{ body: "Opening a chart appends a row to a log nobody can edit, including us." }] }]],
  ["nobody-reads-notes", [{ type: "prose", body: "Nobody else at 24Therapy reads a note unless you ask us." }]],
  ["unregistered-entity", [{ type: "companies", items: [{ title: "24Therapy Inc.", entity: "us" }] }]],
  ["unregistered-entity", [{ type: "companies", items: [{ title: "24Therapy Egypt", entity: "eg" }] }]],
  ["audit-nobody-can-edit", [{ type: "prose", body: "The audit log is append-only: nobody can edit it, including us." }]],
];
for (const [rule, blocks] of PLANTED) {
  const hits = forbiddenClaimsIn("planted", blocks);
  check(`control: a planted "${rule}" claim is caught`, hits.some((hit) => hit.rule === rule), JSON.stringify(blocks));
}

/* The corrected sentences must pass, or the guard would replace good rows. */
const GOOD = [
  { q: "Is a BAA included?", a: "Not yet. No business associate agreement is signed, with you or with any of our providers." },
  "None of these subprocessors has yet signed a business associate agreement or a data processing agreement with us.",
  "BAA available; not yet signed.",
  "The code can hold a jurisdiction's records in a database of its own, but no region outside the United States is open yet.",
  "Clinicians cannot delete a patient or a session.",
  "24Therapy is not yet a registered company.",
  "The log is append-only, enforced by a database trigger.",
];
for (const text of GOOD) {
  const hits = forbiddenClaimsIn("good", [{ type: "prose", body: text }]);
  check(`control: a true sentence is left alone`, hits.length === 0, `${JSON.stringify(text)} ${hits.map((h) => h.rule).join(",")}`);
}
check(
  "control: a FAQ is read as its question and answer together",
  claimStrings({ q: "Q?", a: "A." }).some((entry) => entry.text === "Q? A."),
);
check("every rule has at least one pattern and a reason", FORBIDDEN_CLAIMS.every((r) => r.patterns.length > 0 && r.why.length > 10));

/* ------------------------------------------------------------ defaults -- */

const pages = [
  ...DEFAULT_PAGES.map((page) => ({ ...page, locale: "en" })),
  ...DEFAULT_PAGES_AR.map((page) => ({ ...page, locale: "ar" })),
];
const hits = pages.flatMap((page) => pageClaims(`${page.slug}[${page.locale}]`, page));
check(
  "no shipped default page makes a forbidden claim, in either language",
  hits.length === 0,
  hits.map((hit) => `${hit.where} (${hit.rule}): "${hit.text}"`).join(" · ") || `${pages.length} pages scanned`,
);

for (const required of REQUIRED_STATEMENTS) {
  const page = pages.find((p) => p.slug === required.slug && p.locale === required.locale);
  const text = page ? claimStrings(page.blocks).map((entry) => entry.text).join("\n") : "";
  check(`/${required.slug} [${required.locale}] says ${required.what}`, required.pattern.test(text));
}

/* --------------------------------------------------------------- wiring -- */

const service = readSource("lib/content/service.ts");
check(
  "a published row with a forbidden claim (blocks, title or description) is replaced by the default, or trimmed when it has none, and reported",
  /guardedPage\(/.test(service) && /reportStaleRow\(/.test(service) && /recordError\(/.test(service),
);
{
  const page: { slug: string; title: string; description: string | null; blocks: unknown[] } = { slug: "cms-only", title: "About 24Therapy Inc.", description: "Run by 24Therapy Egypt", blocks: [
    { type: "prose", body: "A fine page." },
    { type: "prose", body: "We are 24Therapy Inc." },
  ] };
  const trimmed = guardedPage("cms-only[en]", page, null);
  check(
    "control: a CMS-only page with a false claim is served without the block, title or description that make it, and reported",
    trimmed.served === "trimmed" &&
      trimmed.hits.length === 3 &&
      (trimmed.page.blocks as unknown[]).length === 1 &&
      trimmed.page.title === "cms-only" &&
      trimmed.page.description === null,
    JSON.stringify(trimmed.page),
  );
  const replaced = guardedPage("x[en]", page, { ...page, title: "About", description: null, blocks: [] });
  check("control: with a code default, the default is served", replaced.served === "default" && replaced.page.title === "About");
}
const admin = readSource("app/(admin)/admin/actions.ts");
check(
  "the editor refuses to save a forbidden claim, in the blocks, title or description",
  /pageClaims\(/.test(admin) && /return \{ error: claimMessage\(/.test(admin),
);

finish("verify:claims-defaults");
