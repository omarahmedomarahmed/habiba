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
  return (
    <div role="status" aria-busy="true" className="px-4 py-6 sm:px-6">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden className="animate-pulse space-y-4 motion-reduce:animate-none">
        <div className="h-7 w-48 rounded-lg bg-slate-200" />
        <div className="h-4 w-72 max-w-full rounded bg-slate-100" />
        <div className="h-32 rounded-2xl border border-slate-200 bg-white" />
        <div className="h-24 rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
