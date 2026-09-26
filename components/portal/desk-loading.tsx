import { RouteLogoLoader } from "@/components/brand/logo-loader";
import { getI18n } from "@/lib/i18n/server";

/**
 * 🔴 C19: WHAT A DESK PORTAL SHOWS WHILE A PAGE IS FETCHED.
 *
 * The company and partner pages each read the database before they render, and
 * with no `loading.tsx` a click on the rail left the old page standing, unmoved,
 * until the new one arrived: read as a dead link, and clicked again. This is the
 * shape of a page (a heading and two cards) inside the desk that stays put, so
 * the rail answers at once. Grey blocks and one word for a screen reader; no
 * spinner, and nothing that pretends to be data.
 */
export async function DeskLoading() {
  const { t } = await getI18n();
  /*
    Founder, 26 September: the one branded loader, the 24T mark, in place of
    the grey blocks. The same mark the page change overlay shows, so a slow
    stream and a slow round trip look alike. See components/brand/logo-loader.tsx.
  */
  return <RouteLogoLoader label={t("common.loading")} className="px-4 py-6 sm:px-6" />;
}
