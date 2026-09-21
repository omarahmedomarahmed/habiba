/**
 * 🔴 76.69 — THE EDIT H49 KEPT ASKING FOR.
 *
 *     npm run content:sync -- pricing competitors
 *     npm run content:sync -- pricing competitors faq --dry
 *
 * ## The defect this is the fix for
 *
 * There has only ever been one way to get a new block onto a published page:
 * `ship:content`, which runs `db:seed --refresh-content`, which **replaces the
 * whole `blocks` array** of every page in every locale from `defaults.ts`.
 *
 * That is a reseed, not an edit, and it destroyed 6,810 bytes of authored
 * English copy the first time it ran, and did it AGAIN, on the same three rows,
 * the day H49 was written about the first time. Both recoveries came out of a
 * Neon preview branch. There is no third preview branch waiting.
 *
 * The reason is structural rather than careless. The CMS is authored-wins:
 * `getPublicPage` reads the row and never merges the defaults into it, so the
 * live rows and `defaults.ts` diverge the moment an operator edits a paragraph
 * — which is the CMS working. After that, the only tool for "add one block"
 * was a tool that overwrites the divergence.
 *
 * ## What this does instead
 *
 * It replaces **only the blocks of the named types**, in place, and leaves
 * every other block in the row byte-identical. The proof is not a promise in
 * this comment: it strips the named types out of the row before and after and
 * refuses to write unless the two remainders are deep-equal (`untouched`
 * below). A bug in the splice cannot reach the database quietly.
 *
 * ## Locale
 *
 * Each locale is synced from ITS OWN defaults, never from English. That is
 * `registry.ts`'s rule and the reason it exists: republishing the English block
 * under `ar` would look like a translated page to every check that counts rows
 * and read as English to the one person it was for. A locale that ships no
 * block of that type is reported and skipped.
 *
 * ## Why it may point at production
 *
 * Because this is what production needs. `ship:content` already reaches
 * production, as the documented exception that calls no guard at all; this is
 * the same destination through the counted door, with an allow-list entry and
 * a written reason, which is strictly the safer of the two. It is the fifth
 * door, and `verify:sprint57` counts them by reading this directory rather than
 * a list, so it will say so.
 */
import { and, eq } from "drizzle-orm";

import type { ContentBlock } from "../lib/db/schema";
import { defaultsFor, localesWithDefaults } from "../lib/content/registry";
import { connect, schema } from "./db";
import { writesTo } from "./_verify";

const { contentPages } = schema;

const DRY = process.argv.includes("--dry");

/** See the `--order` block below. Reordering is a visible edit, so it is asked for. */
const ORDER = process.argv.includes("--order");

/**
 * 🔴 `--drop=hero,showcase` — the block types to REMOVE. Task 137.
 *
 * ## Why this had to exist
 *
 * A named type the defaults no longer ship is reported as "ships no X block,
 * not synced" and left alone. That is the right default: it catches a typo
 * before it deletes a section. But it also means this tool cannot express
 * "this page used to have five heroes and now has one `audiences` block",
 * which is exactly what the homepage rewrite is.
 *
 * Without it the only tool for the job was `ship:content`, which replaces the
 * whole `blocks` array of every page in every locale, and which destroyed
 * 6,810 bytes of authored copy twice. Reaching for it because the surgical
 * tool was one flag short is how that happens a third time.
 *
 * ## Why it is a separate flag rather than inferred
 *
 * Inferring removal from "the defaults no longer ship this type" would make a
 * mistyped type name silently delete every block of the type somebody meant to
 * type. Naming what to drop is one more thing to write and it appears in the
 * shell history, in the log, and in this run's output, which is what a
 * destructive edit should cost.
 *
 * The control below still applies: everything not named, of either kind, must
 * come out byte-identical or nothing is written.
 */
const dropped = (process.argv.find((a) => a.startsWith("--drop=")) ?? "")
  .slice("--drop=".length)
  .split(",")
  .map((one) => one.trim())
  .filter(Boolean);

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const slug = args[0];
const types = args.slice(1);

/** Everything in `blocks` that is NOT one of the types being changed. */
function untouched(blocks: ContentBlock[], changing: string[]): ContentBlock[] {
  return blocks.filter((b) => !changing.includes(b.type));
}

/**
 * Where a block of this type belongs when the row has none yet.
 *
 * Appending would put a comparison table under the footer copy and a vendor
 * grid after the FAQ. The defaults already encode the intended order, so the
 * position is read from there: find the block that precedes it in the defaults
 * and is also present in the row, and go after that one. If nothing matches,
 * append, which is the honest fallback rather than a guess at the middle.
 */
function insertionIndex(row: ContentBlock[], shipped: ContentBlock[], type: string): number {
  const at = shipped.findIndex((b) => b.type === type);
  if (at <= 0) return at === 0 ? 0 : row.length;
  for (let i = at - 1; i >= 0; i -= 1) {
    const before = shipped[i]?.type;
    const found = row.findIndex((b) => b.type === before);
    if (found !== -1) return found + 1;
  }
  return 0;
}

async function main() {
  if (!slug || (types.length === 0 && dropped.length === 0)) {
    console.error(
      "Usage: npm run content:sync -- <slug> <blockType> [blockType...] [--drop=a,b] [--order] [--dry]\n" +
        "\n" +
        "Replaces only the blocks of those types on every locale row of that page,\n" +
        "from that locale's own defaults, leaving every other block untouched.\n" +
        "\n" +
        "--drop names types to REMOVE, for a page whose shape changed. Everything\n" +
        "not named, of either kind, must still come out byte-identical.\n" +
        "\n" +
        "--order puts the row in the defaults' order, for a page whose sections\n" +
        "have drifted out of it. Reordering moves no bytes, so say it out loud.",
    );
    process.exit(1);
  }

  writesTo({ productionIsAllowed: true });
  const { pool, db } = connect();

  console.log(`page: ${slug}`);
  console.log(`types: ${types.join(", ") || "(none)"}`);
  if (dropped.length > 0) console.log(`DROPPING: ${dropped.join(", ")}`);
  if (DRY) console.log("(dry run, nothing is written)");
  console.log("");

  let written = 0;
  let skipped = 0;

  for (const locale of localesWithDefaults()) {
    const shipped = defaultsFor(locale).find((p) => p.slug === slug);
    if (!shipped) {
      console.log(`${locale}: no shipped page for this slug, skipped`);
      skipped += 1;
      continue;
    }

    const rows = await db
      .select()
      .from(contentPages)
      .where(and(eq(contentPages.slug, slug), eq(contentPages.locale, locale)));
    const row = rows[0];
    if (!row) {
      console.log(`${locale}: no row in the database, skipped (seed the page first)`);
      skipped += 1;
      continue;
    }

    /*
     * Types this locale actually ships. A missing one is reported by name: a
     * silent skip is how a page ends up with a comparison in English and
     * nothing in Arabic while every count says both locales were synced.
     */
    const have = types.filter((t) => shipped.blocks.some((b) => b.type === t));
    const missing = types.filter((t) => !have.includes(t));
    for (const t of missing) console.log(`${locale}: ships no "${t}" block, not synced`);

    /* What this row actually carries of the types named for removal. */
    const toDrop = dropped.filter((t) => (row.blocks as ContentBlock[]).some((b) => b.type === t));
    for (const t of dropped.filter((one) => !toDrop.includes(one))) {
      console.log(`${locale}: carries no "${t}" block, nothing to drop`);
    }

    if (have.length === 0 && toDrop.length === 0) {
      skipped += 1;
      continue;
    }

    const before: ContentBlock[] = row.blocks;
    /*
     * The types this run is allowed to change: the ones being replaced and the
     * ones being removed. The control at the bottom is computed against this
     * list, so a block of any other type moving anywhere stops the write.
     */
    const changing = [...have, ...toDrop];
    let next = before.filter((b) => !changing.includes(b.type));

    for (const type of have) {
      const incoming = shipped.blocks.filter((b) => b.type === type);
      /*
       * The original position if the row already had one, so a sync does not
       * quietly move a section down the page; otherwise the defaults' own
       * ordering. `existing` is looked up against `before` because `next` has
       * already had the type removed.
       */
      const existingAt = before.findIndex((b) => b.type === type);
      const at =
        existingAt === -1
          ? insertionIndex(next, shipped.blocks, type)
          : Math.min(existingAt, next.length);
      next = [...next.slice(0, at), ...incoming, ...next.slice(at)];
    }

    /*
     * 🔴 `--order` — PUT THE ROW IN THE DEFAULTS' ORDER. Task: for-patients.
     *
     * ## Why the tool needed this
     *
     * The placement above is incremental and local: each incoming block goes
     * where the row already had one of its type, or after whichever block
     * precedes it in the defaults and is also present. That is exactly right
     * for adding a comparison table to a page somebody has been editing, and
     * it cannot converge when the row's ORDER has drifted from the defaults,
     * because every insertion is measured against neighbours that are
     * themselves in the wrong place.
     *
     * Watched live on /for-patients. One run put the showcase between the two
     * walkthroughs, splitting a pair of flows that answer the same question.
     * Re-running with the walkthroughs named moved them back together and sent
     * the showcase to the very end of the page, below "If you need help right
     * now". Two runs, two wrong orders, neither reachable from the other.
     *
     * ## Positional, not alphabetical, and not by first occurrence
     *
     * The Nth block of a type in the row takes the position of the Nth block
     * of that type in the defaults. Ranking by the type's FIRST index would
     * group the two `features` blocks together and push the showcase after
     * both, which is not the page anybody wrote. A type the defaults do not
     * ship sorts to the end rather than to the front, so an authored block
     * this tool does not know about is never promoted above the hero.
     *
     * Opt-in, because reordering a page is a visible edit that the control
     * below only partly covers. `untouched()` filters and preserves order, so
     * a reorder that changes the RELATIVE order of two blocks this run was not
     * asked to touch is still refused, which is the case worth refusing. What
     * it cannot see is a synced block moving past an untouched one: no bytes
     * change, "untouched, unchanged" stays true, and the page reads top to
     * bottom differently. So it is asked for by name and it says what it did.
     */
    if (ORDER) {
      const slots = new Map<string, number[]>();
      shipped.blocks.forEach((b, i) => {
        slots.set(b.type, [...(slots.get(b.type) ?? []), i]);
      });
      const seen = new Map<string, number>();
      const ranked = next.map((b, i) => {
        const nth = seen.get(b.type) ?? 0;
        seen.set(b.type, nth + 1);
        const list = slots.get(b.type) ?? [];
        return { b, rank: list[nth] ?? Number.MAX_SAFE_INTEGER, i };
      });
      // Tie-break on the original index so blocks the defaults do not ship
      // keep their relative order instead of being shuffled by sort stability.
      ranked.sort((x, y) => x.rank - y.rank || x.i - y.i);
      const moved = ranked.some((r, i) => r.i !== i);
      next = ranked.map((r) => r.b);
      console.log(
        moved
          ? `${locale}: reordered to the defaults' order`
          : `${locale}: already in the defaults' order`,
      );
    }

    /*
     * 🔴 THE CONTROL. Everything this was not asked to touch must be identical,
     * and "must" here means the write does not happen otherwise. This is the
     * assertion H49 would have needed: the failure mode is not a wrong block,
     * it is a right block that took somebody's paragraph with it.
     */
    const a = JSON.stringify(untouched(before, changing));
    const b = JSON.stringify(untouched(next, changing));
    if (a !== b) {
      console.error(`\n${locale}: REFUSING. The blocks not being synced changed.`);
      console.error(`  before: ${String(a.length)} bytes\n  after:  ${String(b.length)} bytes`);
      process.exit(1);
    }

    const sizeBefore = JSON.stringify(before).length;
    const sizeAfter = JSON.stringify(next).length;
    console.log(
      `${locale}: ${[...have.map((t) => `+${t}`), ...toDrop.map((t) => `-${t}`)].join(", ")}` +
        ` · ${String(before.length)} blocks (${String(sizeBefore)} bytes)` +
        ` -> ${String(next.length)} blocks (${String(sizeAfter)} bytes)` +
        ` · untouched ${String(a.length)} bytes, unchanged`,
    );

    if (!DRY) {
      await db
        .update(contentPages)
        .set({ blocks: next, updatedAt: new Date() })
        .where(eq(contentPages.id, row.id));
      written += 1;
    }
  }

  await pool.end();
  console.log(
    `\n${DRY ? "would write" : "wrote"} ${String(written)} row(s), skipped ${String(skipped)}.`,
  );
  if (!DRY && written > 0) {
    console.log("The public pages cache for up to 300 seconds. Publish anything in the");
    console.log("admin console, or wait, before checking the live page.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
