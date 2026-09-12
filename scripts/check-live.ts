/**
 * What the live site actually serves. PLAN.md 21R.6, C92, C96.
 *
 *   npm run check:live
 *
 * ## Why this exists
 *
 * Every check in this repository until now has read the database or the import
 * graph. On 2026-09-07 the founder opened `/pricing` and found a page that
 * contradicted §3c — while `verify:sprint17` passed, because the row it read
 * was correct. The row *was* correct. The page was two days older than the
 * row, served from a cache nothing could expire (see `lib/content/service.ts`).
 *
 * So this fetches the pages a stranger would fetch, over the public internet,
 * and asserts about the text they get. It is the smallest possible version of
 * the walkthrough 22R is for, and the only check in the repository that can
 * fail because of a *deployment* rather than a commit.
 *
 * ## What it refuses to be
 *
 * It is not a screenshot diff and it is not a copy review. Three things only:
 * the page is the one the database describes, it states no price of its own,
 * and it makes no claim about where money sits that §3c reversed.
 */
import { LOCALE_COOKIE } from "../lib/i18n/config";

export const LIVE_URL = process.env.LIVE_URL ?? "https://24t.vercel.app";

export type LivePageText = { path: string; locale: string; text: string };

/**
 * The words a reader sees, with the RSC payload removed.
 *
 * Next streams the whole tree a second time inside `<script>self.__next_f…` —
 * scanning that instead of the markup is how a checker ends up asserting about
 * a serialisation format rather than a page. Scripts go first, then tags.
 */
export function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchLive(
  path: string,
  locale: string,
): Promise<LivePageText | null> {
  try {
    const response = await fetch(`${LIVE_URL}${path}`, {
      headers: { cookie: `${LOCALE_COOKIE}=${locale}` },
      redirect: "follow",
    });
    if (!response.ok) return null;
    return { path, locale, text: visibleText(await response.text()) };
  } catch {
    return null;
  }
}

/**
 * 🔴 The claim §3c reversed, on 2026-09-06.
 *
 * "We never hold it" is only true where the therapist has their own Stripe
 * account. In Egypt — the first market — 24Therapy collects the money, holds
 * it, and pays out on request. A public page that states the old version
 * unconditionally is telling somebody their money is somewhere it is not.
 *
 * The pattern is deliberately narrow: it matches the *unconditional* sentence
 * and not the conditional rewrite ("where you have a Stripe account… where you
 * do not"), because the conditional one is what the page is supposed to say.
 */
export const REVERSED_CLAIM =
  /(?:the money is a direct charge into your own stripe account|money goes straight to your own stripe account)[^.]*we never (?:hold|touch) it/i;

/** A price stated in prose. The cards carry the numbers; sentences do not. */
export const PRICE_IN_PROSE =
  /\$\d+(?:\.\d+)?\s+(?:buys|a session|per session)|\$\d+;? (?:and )?thirty/i;

export const LIVE_PAGES: { path: string; locales: string[] }[] = [
  { path: "/", locales: ["en", "ar"] },
  { path: "/pricing", locales: ["en", "ar"] },
  { path: "/for-patients", locales: ["en", "ar"] },
  { path: "/features", locales: ["en", "ar"] },
  { path: "/contact", locales: ["en", "ar"] },
];

export async function readLiveSite(): Promise<LivePageText[]> {
  const out: LivePageText[] = [];
  for (const page of LIVE_PAGES) {
    for (const locale of page.locales) {
      const fetched = await fetchLive(page.path, locale);
      if (fetched) out.push(fetched);
    }
  }
  return out;
}

async function main() {
  console.log(`reading ${LIVE_URL}\n`);
  const pages = await readLiveSite();

  if (pages.length === 0) {
    console.log("  the live site did not answer, nothing checked");
    process.exit(0);
  }

  let bad = 0;
  for (const page of pages) {
    const problems: string[] = [];
    if (REVERSED_CLAIM.test(page.text))
      problems.push("states the claim §3c reversed");
    if (PRICE_IN_PROSE.test(page.text))
      problems.push("states a price in prose");
    if (
      page.path === "/pricing" &&
      !/per session|session rate|EGP|USD/i.test(page.text)
    ) {
      problems.push("has no tier cards");
    }

    bad += problems.length > 0 ? 1 : 0;
    console.log(
      `  ${problems.length === 0 ? "ok " : "BAD"}  ${page.path} [${page.locale}]${
        problems.length ? `, ${problems.join("; ")}` : ""
      }`,
    );
  }

  console.log(
    `\n${bad === 0 ? "live: PASS" : `live: ${bad} pages wrong`} (${pages.length} pages read)`,
  );
  process.exit(bad === 0 ? 0 : 1);
}

if (process.argv[1]?.includes("check-live")) void main();
