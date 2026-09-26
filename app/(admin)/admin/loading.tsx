import { RouteLogoLoader } from "@/components/brand/logo-loader";
import { getI18n } from "@/lib/i18n/server";

/**
 * 🔴 A18: WHAT THE CONSOLE SHOWS WHILE A PAGE IS STILL ASKING THE DATABASE.
 *
 * Every admin page is `force-dynamic` and several run a dozen queries before
 * they render. With no boundary the click on a nav link
 * did nothing visible until all of them came back, which on a queue worked by
 * the minute reads as a dead button and gets pressed again.
 *
 * Inside `(admin)/layout.tsx`, so the nav stays put and only the page area is
 * stood in for. A title bar and three cards, the shape most console pages
 * have, in grey: light enough to be replaced without a jump. Its one word is
 * for a screen reader and is the word every portal already says.
 */
export default async function AdminLoading() {
  const { t } = await getI18n();
  /*
    Founder, 26 September: the one branded loader, the 24T mark, in place of
    the grey blocks. The same mark the page change overlay shows, so a slow
    stream and a slow round trip look alike. See components/brand/logo-loader.tsx.
  */
  return <RouteLogoLoader label={t("common.loading")} />;
}
