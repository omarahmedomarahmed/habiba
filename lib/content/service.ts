import "server-only";

import { unstable_cache } from "next/cache";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";

import { db, isDatabaseUnavailable } from "@/lib/db";
import { contentPages, type ContentBlock } from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { DEFAULT_PAGES, findDefaultPage } from "./defaults";

/**
 * One tag for the whole public site.
 *
 * Publishing any page can change every other page — the navigation and the
 * footer are built from the same table, so editing one page's `navLabel`
 * changes the header on all of them. Per-slug tags would leave the other pages
 * showing a stale menu, which is a worse bug than a slightly broader
 * invalidation.
 */
export const CMS_TAG = "cms";

/**
 * Cache the database read, not the page.
 *
 * The marketing pages cannot be statically rendered: they read a cookie to
 * pick a language, and `cookies()` opts a route out of static rendering
 * entirely. That is not a mistake to undo — the alternative is URL-prefixed
 * locales and restructuring every route in the app — but it did mean the
 * homepage was rendering on every single request and hitting Postgres each
 * time. `/` showed as `ƒ` in the build output and every visit was a
 * `cache=MISS`.
 *
 * So the page stays dynamic and the *data* is cached instead. Rendering per
 * request is cheap; talking to a database in Oregon is not. The read happens
 * once per invalidation rather than once per visitor, which takes the database
 * out of the request path without giving up the cookie.
 *
 * `revalidate: false` means it never expires on a timer. The only thing that
 * refreshes it is `revalidateTag(CMS_TAG)`, which is what publishing does —
 * so a marketing page view stops waking the database at all.
 */
function cached<Args extends unknown[], Result>(
  keyParts: string[],
  fn: (...args: Args) => Promise<Result>,
) {
  return unstable_cache(fn, keyParts, { tags: [CMS_TAG], revalidate: false });
}

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
  /*
   * The cookie is read here and the locale passed down as an argument.
   *
   * It cannot be read inside the cached function: `unstable_cache` forbids
   * dynamic APIs, and a cache keyed on something it cannot see would serve one
   * visitor's language to the next. Passing it in makes it part of the key.
   */
  const { getLocale } = await import("@/lib/i18n/server");
  const locale = await getLocale();
  return cached(["cms", "page"], readPage)(slug, locale);
}

async function readPage(slug: string, locale: string): Promise<PublicPage | null> {
  {
    // Kept as a block so the try/catch below reads unchanged.
  }
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
  return cached(["cms", "nav"], readNav)(locale);
}

async function readNav(locale: string): Promise<NavItem[]> {
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
  const { getLocale } = await import("@/lib/i18n/server");
  return cached(["cms", "footer"], readFooter)(await getLocale());
}

async function readFooter(locale: string): Promise<NavItem[]> {
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
     * Deduplicated by slug, like the navigation above.
     *
     * No legal page has an Arabic row yet, so this changes nothing today — and
     * it is the same bug the navigation had the moment Arabic content was
     * added, waiting for the first translated Terms page to trigger it.
     */
    const bySlug = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const existing = bySlug.get(row.slug);
      if (!existing || (row.locale === locale && existing.locale !== locale)) {
        bySlug.set(row.slug, row);
      }
    }

    const legal = [...bySlug.values()]
      .filter((r) => r.navLabel && (r.navOrder ?? 0) >= 10)
      .sort((a, b) => (a.navOrder ?? 0) - (b.navOrder ?? 0));
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
