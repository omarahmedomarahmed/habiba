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

export const LIVE_URL = process.env.LIVE_URL ?? "https://24therapy.app";

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

/*
 * 🔴 C356 — DELETED, AND THE DELETION IS THE FIX.
 *
 * `PRICE_IN_PROSE` matched a price in rendered text, and both places that ran
 * it have now stopped, for the same reason written out twice: rendered HTML
 * cannot tell a price interpolated from `platform_settings` a millisecond ago
 * from one typed into a CMS body in 2025, and the rule is about which of those
 * it is. `verify:sprint21r` moved the question to the source in sprint 46 and
 * left this copy running; it condemned the homepage and the pricing page on
 * every run from then until now.
 *
 * Keeping the export "in case" is how a scan nobody can justify gets picked up
 * again by the next person who needs a regex for prices. The question it was
 * meant to ask is asked, at the source, by `verify:sprint21r`'s `LITERAL_PRICE`
 * over `lib/content/defaults.ts` and `defaults-ar.ts`, with a control in both
 * directions. That is the one to reach for.
 */

export const LIVE_PAGES: { path: string; locales: string[] }[] = [
  { path: "/", locales: ["en", "ar"] },
  { path: "/pricing", locales: ["en", "ar"] },
  { path: "/for-patients", locales: ["en", "ar"] },
  { path: "/features", locales: ["en", "ar"] },
  { path: "/contact", locales: ["en", "ar"] },
  /*
   * 🔴 C354 — THE LIST WAS FIVE PAGES OLD, AND THE SITE HAS FOURTEEN.
   *
   * Every page below shipped after this array was written and none of them was
   * added to it, so the live check and the smoke test were both answering
   * honestly about a third of the public site. `/pricing` was in the list and
   * was found; `/for-clinics`, which sprint 65 rewrote, was not in it and would
   * not have been.
   *
   * The audiences are hand-built pages rather than CMS rows, which is exactly
   * why they need to be here: a CMS page that fails to render fails for one
   * reason, and a hand-built one can fail for any reason its code can.
   *
   * The legal pages are English only. That is the product's own state rather
   * than an omission here: `content_pages` has no Arabic row for them, and
   * asking for one would report a translation gap as a rendering failure.
   */
  { path: "/for-clinics", locales: ["en", "ar"] },
  { path: "/for-companies", locales: ["en", "ar"] },
  { path: "/integrations", locales: ["en", "ar"] },
  { path: "/developers", locales: ["en", "ar"] },
  { path: "/radar", locales: ["en", "ar"] },
  { path: "/privacy", locales: ["en"] },
  { path: "/terms", locales: ["en"] },
  { path: "/security", locales: ["en"] },
  { path: "/hipaa", locales: ["en"] },
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

  /*
   * 🔴 C356 — THE CARD MARKER IS DERIVED FROM THE DICTIONARY, NOT TYPED HERE.
   *
   * This asked `/per session|session rate|EGP|USD/i`. Two things were wrong
   * with it and both were already diagnosed, in `verify:sprint21r`, which fixed
   * them in its own copy of this check and left this one alone.
   *
   * It is English, so the Arabic pricing page failed it while rendering its
   * cards perfectly: Arabic money is not formatted with the letters "USD". And
   * it is a hardcoded phrase for copy the product owns, so 46.9's rewrite of
   * the card to "{amount} every session" would have taken it red on a correct
   * page in English too.
   *
   * `pricing.platformLine` IS the card, so the wording around its placeholder
   * is the marker, in whichever language the reader asked for, taken from the
   * same dictionary the page renders from.
   */
  const { DICTIONARIES } = await import("../lib/i18n/messages");
  const cardMarker = (locale: string) =>
    (DICTIONARIES[locale === "ar" ? "ar" : "en"]["pricing.platformLine"] ?? "")
      .replace(/\{\w+\}/g, "")
      .trim();

  let bad = 0;
  for (const page of pages) {
    const problems: string[] = [];
    if (REVERSED_CLAIM.test(page.text))
      problems.push("states the claim §3c reversed");
    /*
     * 🔴 C356 — `PRICE_IN_PROSE` IS NOT RUN OVER RENDERED HTML, AND THAT IS THE
     * WHOLE POINT OF THE RULE.
     *
     * "The cards carry the numbers" means a price must come from
     * `platform_settings` through the pricing component rather than be typed
     * into an editable CMS body where it goes stale the day the fee changes.
     * **Rendered HTML cannot tell those two apart**: `$4 a session` looks
     * identical whether it was interpolated a millisecond ago or typed in 2025.
     *
     * So this check condemned `pricing.headline`, which 46.9 asked for and
     * whose numbers ARE read live from settings, and it did so on the homepage
     * and the pricing page on every run. `verify:sprint21r` reached exactly
     * this conclusion and moved the question to the source, where it is
     * answerable: no CMS default, in either language, may contain a literal
     * currency amount.
     *
     * That scan lives there. This file reads the live site, so it asks the
     * questions only a live site can answer and leaves that one alone.
     */
    if (page.path === "/pricing" && !page.text.includes(cardMarker(page.locale))) {
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
