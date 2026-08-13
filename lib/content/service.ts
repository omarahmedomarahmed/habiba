import "server-only";

import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";

import { db, isDatabaseUnavailable } from "@/lib/db";
import { contentPages, type ContentBlock } from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { DEFAULT_PAGES, findDefaultPage } from "./defaults";

export type PublicPage = {
  slug: string;
  title: string;
  description: string | null;
  layout: "marketing" | "document";
  blocks: ContentBlock[];
};

/**
 * Load a published page.
 *
 * Falls back to the built-in definition whenever the database is unreachable or
 * the CMS table is missing. Two reasons that matters: the marketing site should
 * not go dark because Postgres blinked, and `next build` prerenders these
 * routes — without a fallback, a build machine that cannot reach the database
 * fails the deploy rather than shipping a static page.
 */
export async function getPublicPage(slug: string): Promise<PublicPage | null> {
  const { getLocale } = await import("@/lib/i18n/server");
  const locale = await getLocale();

  try {
    /*
     * The requested language, then English.
     *
     * The fallback is deliberate and is the opposite of the rule for interface
     * strings, where an English fallback is banned and the type system
     * enforces it. The difference is what a gap means: a missing UI string is
     * a bug somebody forgot, and showing English there hides it. A missing CMS
     * page is content nobody has written yet, and a patient looking for the
     * crisis radar needs the page more than they need it in their language.
     *
     * Ordering by locale puts the exact match first — `desc` works because the
     * only two values are 'en' and 'ar' and we filter to the pair we want.
     */
    const rows = await db
      .select()
      .from(contentPages)
      .where(
        and(
          eq(contentPages.slug, slug),
          inArray(contentPages.locale, locale === "en" ? ["en"] : [locale, "en"]),
        ),
      );

    const row =
      rows.find((candidate) => candidate.locale === locale && candidate.status === "published") ??
      rows.find((candidate) => candidate.locale === "en");

    if (row && row.status === "published") {
      return {
        slug: row.slug,
        title: row.title,
        description: row.description,
        layout: row.layout,
        blocks: row.blocks,
      };
    }
    if (row) return null; // exists but is a draft
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    log.warn("CMS unavailable, serving built-in content", { slug });
  }

  const fallback = findDefaultPage(slug);
  if (!fallback) return null;
  return {
    slug: fallback.slug,
    title: fallback.title,
    description: fallback.description,
    layout: fallback.layout,
    blocks: fallback.blocks,
  };
}

export type NavItem = { slug: string; label: string };

export async function getPublicNav(): Promise<NavItem[]> {
  const { getLocale } = await import("@/lib/i18n/server");
  const locale = await getLocale();

  try {
    const rows = await db
      .select({
        slug: contentPages.slug,
        locale: contentPages.locale,
        navLabel: contentPages.navLabel,
        navOrder: contentPages.navOrder,
      })
      .from(contentPages)
      .where(isNotNull(contentPages.navLabel))
      .orderBy(asc(contentPages.navOrder));

    /*
     * One entry per slug, in the reader's language where it exists.
     *
     * Adding Arabic rows made this query return the same page twice — once per
     * locale — which would have put every item in the navigation bar twice,
     * each in a different language. Collapsing by slug and preferring the
     * requested locale is what keeps one page one link, and it keeps the
     * English label as the fallback for a page nobody has translated yet.
     */
    const bySlug = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const existing = bySlug.get(row.slug);
      if (!existing || (row.locale === locale && existing.locale !== locale)) {
        bySlug.set(row.slug, row);
      }
    }

    const published = [...bySlug.values()]
      .filter((r) => r.navLabel && (r.navOrder ?? 99) < 10)
      .sort((a, b) => (a.navOrder ?? 99) - (b.navOrder ?? 99));

    if (published.length > 0) {
      return published.map((r) => ({ slug: r.slug, label: r.navLabel! }));
    }
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
  }

  return DEFAULT_PAGES.filter((p) => p.navLabel && (p.navOrder ?? 99) < 10).map((p) => ({
    slug: p.slug,
    label: p.navLabel!,
  }));
}

export async function getFooterLinks(): Promise<NavItem[]> {
  try {
    const rows = await db
      .select({
        slug: contentPages.slug,
        navLabel: contentPages.navLabel,
        navOrder: contentPages.navOrder,
      })
      .from(contentPages)
      .where(isNotNull(contentPages.navLabel))
      .orderBy(asc(contentPages.navOrder));

    const legal = rows.filter((r) => r.navLabel && (r.navOrder ?? 0) >= 10);
    if (legal.length > 0) return legal.map((r) => ({ slug: r.slug, label: r.navLabel! }));
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
  }

  return DEFAULT_PAGES.filter((p) => p.navLabel && (p.navOrder ?? 0) >= 10).map((p) => ({
    slug: p.slug,
    label: p.navLabel!,
  }));
}

/** Every published page, for the sitemap. Falls back to the shipped defaults. */
export async function publishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  try {
    const rows = await db
      .select({ slug: contentPages.slug, updatedAt: contentPages.updatedAt })
      .from(contentPages)
      .where(eq(contentPages.status, "published"));
    if (rows.length > 0) return rows;
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
  }

  return DEFAULT_PAGES.map((page) => ({ slug: page.slug, updatedAt: new Date() }));
}

/** Admin view: every page, drafts included. */
export async function listAllPages() {
  return db.select().from(contentPages).orderBy(asc(contentPages.navOrder), asc(contentPages.slug));
}

export async function getPageById(id: string) {
  const [row] = await db.select().from(contentPages).where(eq(contentPages.id, id)).limit(1);
  return row ?? null;
}
