import { RouteLogoLoader } from "@/components/brand/logo-loader";
import { getI18n } from "@/lib/i18n/server";

/**
 * 🔴 T20: WHAT A PRACTICE MANAGER SEES WHILE A PAGE IS FETCHED.
 *
 * Every clinic page reads through the wall, audits the read and only then renders,
 * so moving between tabs left the old page standing with no sign of progress. A few
 * grey bars in the shape of a heading and a table, so the layout does not jump when
 * the page lands, and a sentence for a screen reader in the reader's language.
 */
export default async function ClinicLoading() {
  const { t } = await getI18n();

  /*
    Founder, 26 September: the one branded loader, the 24T mark, in place of
    the grey blocks. The same mark the page change overlay shows, so a slow
    stream and a slow round trip look alike. See components/brand/logo-loader.tsx.
  */
  return <RouteLogoLoader label={t("common.loading")} />;
}
