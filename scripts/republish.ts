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
import { and, eq } from "drizzle-orm";

import { connect, schema } from "./db";
import { DEFAULT_PAGES } from "../lib/content/defaults";
import { DEFAULT_PAGES_AR } from "../lib/content/defaults-ar";

async function main() {
  const argv = process.argv.slice(2);
  const all = argv.includes("--all");
  /*
   * Arabic rows are inserted when missing, unlike English ones.
   *
   * The English branch below deliberately refuses to insert — a slug with no
   * row is already being served from defaults.ts, and creating one would only
   * open the divergence this script exists to close. Arabic is the opposite
   * case: there is no Arabic fallback in defaults.ts, so a missing row means
   * the page simply is not available in Arabic and inserting it is the point.
   */
  const arabic = argv.includes("--ar");
  const wanted = argv.filter((arg) => !arg.startsWith("--"));

  if (!all && wanted.length === 0) {
    console.error("Name the slugs to republish, or pass --all.");
    console.error(`Known: ${DEFAULT_PAGES.map((page) => page.slug).join(", ")}`);
    process.exit(1);
  }

  const source = arabic ? DEFAULT_PAGES_AR : DEFAULT_PAGES;
  const locale = arabic ? "ar" : "en";
  const pages = all ? source : source.filter((page) => wanted.includes(page.slug));

  const missing = wanted.filter((slug) => !source.some((page) => page.slug === slug));
  if (missing.length > 0) {
    console.error(`No built-in ${locale} page for: ${missing.join(", ")}`);
    process.exit(1);
  }

  const { db, pool } = connect();

  for (const page of pages) {
    const [existing] = await db
      .select({ id: schema.contentPages.id, title: schema.contentPages.title })
      .from(schema.contentPages)
      .where(and(eq(schema.contentPages.slug, page.slug), eq(schema.contentPages.locale, locale)))
      .limit(1);

    if (!existing && arabic) {
      await db.insert(schema.contentPages).values({
        slug: page.slug,
        locale,
        title: page.title,
        description: page.description,
        layout: page.layout,
        navLabel: page.navLabel,
        navOrder: page.navOrder,
        blocks: page.blocks,
        status: "published",
      });
      console.log(`+ ${page.slug} [${locale}] — created (${page.blocks.length} blocks)`);
      continue;
    }

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
        locale,
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
      `✓ ${page.slug} [${locale}] — "${existing.title}" → "${page.title}"`,
    );
  }

  await pool.end();

  /*
   * Tell the running deployment, because nothing else will.
   *
   * The public pages no longer expire on a timer, so a script that writes to
   * the database from a laptop leaves the live site serving cached content
   * indefinitely. That is the cost of taking the database out of the request
   * path, and it is paid here.
   *
   * A failure is reported and not thrown: the rows are already written, and
   * exiting non-zero would suggest they were not.
   */
  const target = process.env.APP_URL ?? "https://habiba-zeta.vercel.app";
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.log(`\n! CRON_SECRET is not set — could not refresh ${target}.`);
    console.log("  The database is updated; the live site will keep serving cached pages.");
    return;
  }

  try {
    const response = await fetch(`${target}/api/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    console.log(
      response.ok
        ? `\n✓ ${target} refreshed`
        : `\n! ${target} refused the refresh (${response.status}) — pages may be stale`,
    );
  } catch (error) {
    console.log(`\n! could not reach ${target}: ${(error as Error).message}`);
    console.log("  The database is updated; the live site will keep serving cached pages.");
  }
}

void main();
