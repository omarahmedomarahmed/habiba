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
 *
 * 🔴 IT IS MOUNTED ONE LEVEL BELOW THE GROUP, in each section's own
 * `loading.tsx`, never as `app/(app)/loading.tsx`. A boundary at the group
 * root wraps the whole section (`/sessions`), so going from `/sessions/new`
 * back to `/sessions` kept that boundary on screen and the transition waited
 * on it; on the production build the navigation then never finished, one tap
 * in three, and the page simply did nothing. The same held for every portal,
 * and for the patient's sign-in, which never left "Working...". A boundary
 * per section is keyed by the section, so a change of page commits the
 * skeleton at once and the page replaces it. `verify:launch` holds the rule.
 */
export async function ClinicianLoading() {
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
