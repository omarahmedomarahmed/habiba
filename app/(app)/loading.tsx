import { getI18n } from "@/lib/i18n/server";

/**
 * 🔴 T20: WHAT A CLINICIAN SEES WHILE A PAGE IS FETCHED.
 *
 * Every page in this portal is `force-dynamic` and reads the database before it
 * renders, so a tap on a tab used to leave the previous page on screen with no sign
 * that anything was happening, and the usual response to that is a second tap.
 *
 * A few grey bars in the shape of a heading and a list, not a spinner: the layout
 * does not jump when the page lands. The words are for a screen reader only, in the
 * reader's language, because a skeleton says nothing out loud.
 */
export default async function PortalLoading() {
  const { t } = await getI18n();

  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden className="animate-pulse space-y-3">
        <div className="h-6 w-40 rounded-lg bg-navy-100" />
        <div className="h-16 rounded-2xl bg-navy-50" />
        <div className="h-16 rounded-2xl bg-navy-50" />
        <div className="h-16 rounded-2xl bg-navy-50" />
      </div>
    </div>
  );
}
