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

  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden className="animate-pulse space-y-4">
        <div className="h-6 w-48 rounded-lg bg-slate-200" />
        <div className="h-4 w-72 max-w-full rounded bg-slate-100" />
        <div className="h-40 rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}
