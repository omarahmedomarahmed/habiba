/**
 * Push built-in page content over the top of what is in the database.
 *
 *   npx tsx scripts/republish.ts hipaa security
 *   npx tsx scripts/republish.ts --all
 *
 * The CMS is authored-content-wins: `getPublicPage` returns the database row
 * whenever one exists and only falls back to `defaults.ts` when it does not.
 * That is the right precedence — an administrator who edits a page should not
 * have it silently reverted by a deploy — but it means a correction made in
 * the repository does not reach a site whose pages were seeded once and have
 * been served from the database ever since.
 *
 * Which is exactly the situation the compliance rewrite found itself in: the
 * file said one thing, the live page said another, and the live page was the
 * one making a claim we could not stand behind.
 *
 * So this is deliberate and narrow. It names the slugs to overwrite rather
 * than syncing everything, prints what it is about to replace, and leaves
 * every page it was not asked about alone.
 */
import { eq } from "drizzle-orm";

import { connect, schema } from "./db";
import { DEFAULT_PAGES } from "../lib/content/defaults";

async function main() {
  const argv = process.argv.slice(2);
  const all = argv.includes("--all");
  const wanted = argv.filter((arg) => !arg.startsWith("--"));

  if (!all && wanted.length === 0) {
    console.error("Name the slugs to republish, or pass --all.");
    console.error(`Known: ${DEFAULT_PAGES.map((page) => page.slug).join(", ")}`);
    process.exit(1);
  }

  const pages = all ? DEFAULT_PAGES : DEFAULT_PAGES.filter((page) => wanted.includes(page.slug));

  const missing = wanted.filter((slug) => !DEFAULT_PAGES.some((page) => page.slug === slug));
  if (missing.length > 0) {
    console.error(`No built-in page for: ${missing.join(", ")}`);
    process.exit(1);
  }

  const { db, pool } = connect();

  for (const page of pages) {
    const [existing] = await db
      .select({ id: schema.contentPages.id, title: schema.contentPages.title })
      .from(schema.contentPages)
      .where(eq(schema.contentPages.slug, page.slug))
      .limit(1);

    if (!existing) {
      // Nothing in the database means the fallback is already serving this
      // page, and the fallback is the file we just edited. Inserting a row
      // here would only create the divergence this script exists to close.
      console.log(`· ${page.slug} — no row, already served from defaults`);
      continue;
    }

    await db
      .update(schema.contentPages)
      .set({
        title: page.title,
        description: page.description,
        layout: page.layout,
        navLabel: page.navLabel,
        navOrder: page.navOrder,
        blocks: page.blocks,
        status: "published",
        updatedAt: new Date(),
      })
      .where(eq(schema.contentPages.id, existing.id));

    console.log(
      `✓ ${page.slug} — "${existing.title}" → "${page.title}" (${page.blocks.length} blocks)`,
    );
  }

  await pool.end();
}

void main();
