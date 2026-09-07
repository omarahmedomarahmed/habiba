/**
 * Is there published content in this database yet? PLAN.md 21R.9, C93.
 *
 * ## Why this is one module and not a line in six verifiers
 *
 * C90 ruled that a check waiting on content a later sprint publishes is
 * **skipped with its reason printed**, never failed. C93 is the sequel: that
 * ruling was applied to the two files that were red and not to the rule, so
 * sprint 18R and sprint 19 shipped new content checks that fail on an empty
 * database — the same defect, two sprints later, because the pattern lived in
 * a comment rather than in a module somebody has to import.
 *
 * So the precondition is written once, here, and every verifier that reads
 * published content asks this module rather than inventing its own test. Two
 * things follow, and both matter more than the tidiness:
 *
 *   - **Sprint 22 purges the database.** Every content check in the repository
 *     goes red the moment that runs and stays red until 22.8b republishes. A
 *     gate that is red for a known reason is a gate everybody skims, and the
 *     purge is precisely when nobody can afford to skim one.
 *   - **A skip has to switch itself back on.** `ready` is a query, not a flag:
 *     when the content is there the checks run, with no file edited and nobody
 *     remembering to delete a `SKIP = true`.
 */
import { like, notLike } from "drizzle-orm";

import { db } from "../lib/db";
import { contentPages, type ContentBlock } from "../lib/db/schema";

/** The sprint step that publishes content into a purged database. */
export const AWAITS = "22.8b";

export type LivePage = {
  slug: string;
  locale: string;
  status: string;
  /** Navigation is part of whether a page is *reachable*, so it is read here. */
  navLabel: string | null;
  navOrder: number | null;
  blocks: ContentBlock[];
};

/**
 * Every page a reader could reach, staging rows excluded.
 *
 * 19.0a writes `en-x-staging` copies so a page can be rendered and read before
 * its code deploys. They are scaffolding: no reader path requests those
 * locales, they carry no navigation, and a verifier that counts them passes on
 * its own props — which 18.5 did, the first time this ran after they existed.
 */
export async function livePages(): Promise<LivePage[]> {
  return db
    .select({
      slug: contentPages.slug,
      locale: contentPages.locale,
      status: contentPages.status,
      navLabel: contentPages.navLabel,
      navOrder: contentPages.navOrder,
      blocks: contentPages.blocks,
    })
    .from(contentPages)
    .where(notLike(contentPages.locale, "%-x-staging"));
}

/**
 * The staging copies. 19.0a.
 *
 * Read separately and named separately, because they are the opposite of a
 * published page: written so a page can be rendered and read *before* its code
 * deploys, requested by no reader path, and excluded from the navigation
 * query. A verifier that wants them is asserting about the scaffolding.
 */
export async function stagedPages(): Promise<LivePage[]> {
  return db
    .select({
      slug: contentPages.slug,
      locale: contentPages.locale,
      status: contentPages.status,
      navLabel: contentPages.navLabel,
      navOrder: contentPages.navOrder,
      blocks: contentPages.blocks,
    })
    .from(contentPages)
    .where(like(contentPages.locale, "%-x-staging"));
}

/**
 * The readiness questions a verifier actually asks, over one read.
 *
 * `why()` returns the sentence printed beside the skip. It names the content
 * that is missing rather than the sprint that will bring it, because the
 * reason a gate is amber has to be legible to somebody who was not here.
 */
export function readiness(pages: LivePage[]) {
  const published = pages.filter((page) => page.status === "published");

  const hasPage = (slug: string) =>
    published.some((page) => page.slug === slug);

  const hasBlock = (slug: string, type: string) =>
    published.some(
      (page) =>
        page.slug === slug && page.blocks.some((block) => block.type === type),
    );

  return {
    published,
    hasPage,
    hasBlock,
    /** Any content at all. The coarse precondition, for a whole-corpus scan. */
    anyContent: published.length > 0,
    why: (what: string) => `${what} is not published in this database`,
  };
}

export type Content = ReturnType<typeof readiness>;

/**
 * 🔴 21R.9 / C93 — the rule, made structural rather than remembered.
 *
 * Published content is **only reachable inside this callback**, and the
 * callback does not run when the content it names is absent: the reporter
 * records a skip with its reason instead. So a check that reads content cannot
 * be written outside a deferral — not because a reviewer noticed, but because
 * the variable does not exist out there.
 *
 * That is the difference between C90's ruling and C93's: C90 was applied to
 * the two files that were red, and sprint 18R then wrote four more checks that
 * failed on an empty database. A pattern in a comment is a pattern somebody
 * forgets. A parameter is not.
 *
 *     await withPublishedContent(skipUnless, { for: "18R.2", what: "the contact page",
 *       slug: "contact" }, (content) => { … });
 */
export async function withPublishedContent(
  skipUnless: (
    ready: boolean,
    deferredTo: string,
    reason: string,
    fn: () => void | Promise<void>,
  ) => Promise<void>,
  need: {
    /** The plan item these checks belong to, printed beside the skip. */
    for: string;
    /** What is missing, in words a reader who was not here can act on. */
    what: string;
    /** Optional narrower preconditions than "there is content at all". */
    slug?: string;
    block?: { slug: string; type: string };
    pages?: LivePage[];
  },
  body: (content: Content) => void | Promise<void>,
): Promise<void> {
  const pages = need.pages ?? (await livePages());
  const content = readiness(pages);

  const ready = need.block
    ? content.hasBlock(need.block.slug, need.block.type)
    : need.slug
      ? content.hasPage(need.slug)
      : content.anyContent;

  await skipUnless(
    ready,
    AWAITS,
    `${need.for} — ${content.why(need.what)}`,
    () => body(content),
  );
}
