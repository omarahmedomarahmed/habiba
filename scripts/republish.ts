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
import { defaultsFor, localesWithDefaults } from "../lib/content/registry";

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
  /*
   * 19.7 / C77 — the language is a value, not a flag.
   *
   * `--ar` was a boolean, and a boolean cannot express a third language. It is
   * still accepted because it is in muscle memory and in the build log, but it
   * is now shorthand for `--locale=ar`, and everything below reads the locale.
   */
  const localeArg = argv.find((arg) => arg.startsWith("--locale="))?.split("=")[1];
  const arabic = argv.includes("--ar") || localeArg === "ar";
  /** 18.5 — insert a row for a page that is genuinely new. See below. */
  const create = argv.includes("--create");
  /*
   * 🔴 19.0a / C89 — write into a STAGING LOCALE instead of the live one.
   *
   * Sprints 17 and 18 are code-complete and invisible: their content cannot be
   * published to production until the code that renders it is deployed
   * (22.8b), so nothing has ever proved the new pages render at all. A staging
   * locale fixes that without touching a served page — `getPublicPage` only
   * ever asks for the reader's locale or `en`, so `en-x-staging` is reachable
   * by a script and by nobody else. What 22 finally runs is then a script that
   * has been *executed against production*, not one that has been written.
   */
  const staging = argv.includes("--staging");
  const wanted = argv.filter((arg) => !arg.startsWith("--"));

  if (!all && wanted.length === 0) {
    console.error("Name the slugs to republish, or pass --all.");
    console.error(`Known: ${DEFAULT_PAGES.map((page) => page.slug).join(", ")}`);
    process.exit(1);
  }

  const base = localeArg ?? (arabic ? "ar" : "en");
  if (!localesWithDefaults().includes(base as never)) {
    console.error(
      `No built-in content for "${base}". Shipped languages: ${localesWithDefaults().join(", ")}.`,
    );
    process.exit(1);
  }
  const source = defaultsFor(base);
  const locale = staging ? `${base}-x-staging` : base;
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

    if (!existing && (arabic || create || staging)) {
      await db.insert(schema.contentPages).values({
        slug: page.slug,
        locale,
        title: page.title,
        description: page.description,
        layout: page.layout,
        /*
         * 🔴 A staging row is never in the navigation.
         *
         * `readNav` reads every locale and collapses by slug, so a staged page
         * carrying a nav label would appear in the live menu of the *running*
         * deployment — before the code that renders it exists. The service
         * also excludes staging locales outright; this is the other lock.
         */
        navLabel: staging ? null : page.navLabel,
        navOrder: staging ? null : page.navOrder,
        blocks: page.blocks,
        status: "published",
      });
      console.log(`+ ${page.slug} [${locale}] — created (${page.blocks.length} blocks)`);
      continue;
    }

    if (!existing) {
      /*
       * Nothing in the database means the fallback is already serving this
       * page, and the fallback is the file we just edited. Inserting a row
       * here would only create the divergence this script exists to close.
       *
       * `--create` is the one exception, and it is for a page that is new in
       * this sprint rather than one that has drifted: 18.5 requires every new
       * page to be a real `content_pages` row, because a page that exists only
       * in `defaults.ts` cannot be edited in admin or translated in 21 — it is
       * invisible to both.
       */
      console.log(
        `· ${page.slug} — no row, already served from defaults (pass --create to make one)`,
      );
      continue;
    }

    await db
      .update(schema.contentPages)
      .set({
        locale,
        title: page.title,
        description: page.description,
        layout: page.layout,
        navLabel: staging ? null : page.navLabel,
        navOrder: staging ? null : page.navOrder,
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
