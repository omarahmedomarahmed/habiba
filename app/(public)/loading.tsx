import { getI18n } from "@/lib/i18n/server";

/**
 * 🔴 0165: WHAT THE PUBLIC SITE SHOWS WHILE A PAGE IS FETCHED.
 *
 * The radar and the clinician profiles read the database before they render,
 * and a tap that leaves the old page frozen reads as a dead link. Inside the
 * site's own `<main>`, so the header and footer stay put and this is a `div`
 * rather than a second `main`. Its one word is for a screen reader.
 */
export default async function PublicLoading() {
  const { t } = await getI18n();

  return (
    <div role="status" aria-busy="true" className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden className="animate-pulse space-y-4">
        <div className="h-8 w-2/3 max-w-md rounded-lg bg-slate-200" />
        <div className="h-4 w-full max-w-xl rounded-lg bg-slate-100" />
        <div className="h-32 rounded-2xl bg-slate-100" />
        <div className="h-32 rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}
