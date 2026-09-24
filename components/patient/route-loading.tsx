import { SosOrb } from "@/components/patient/sos-orb";
import { getI18n } from "@/lib/i18n/server";

/**
 * 🔴 P19: WHAT A PATIENT SEES WHILE A PAGE IS BEING BUILT.
 *
 * Every patient page is `force-dynamic` and reads the database before it
 * renders, and there was no `loading.tsx` anywhere, so a tap on the bar left
 * the previous screen frozen under the finger until the next one arrived. On
 * a phone on a slow connection that reads as a tap that did nothing, and the
 * usual answer to that is to tap again.
 *
 * A few grey blocks in the shape of a page, and no words beyond the one a
 * screen reader announces. Light on purpose: this is on screen for a moment,
 * and anything that has to load is exactly what it is waiting for.
 *
 * `withOrb` is for `/pay` and `/join`, which draw their own SOS orb in the page
 * rather than in a layout, so without it the orb would vanish for as long as
 * the page is loading. Inside `(patient)` the chrome already has one.
 */
export async function RouteLoading({ withOrb = false }: { withOrb?: boolean }) {
  const { t } = await getI18n();

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-8"
      aria-busy="true"
    >
      <span role="status" className="sr-only">
        {t("common.loading")}
      </span>
      <div aria-hidden className="animate-pulse space-y-4">
        <div className="h-6 w-1/2 rounded-lg bg-slate-200" />
        <div className="h-4 w-3/4 rounded-lg bg-slate-200" />
        <div className="h-28 rounded-2xl bg-slate-100" />
        <div className="h-28 rounded-2xl bg-slate-100" />
      </div>
      {withOrb ? <SosOrb /> : null}
    </main>
  );
}
