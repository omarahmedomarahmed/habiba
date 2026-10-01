import type { Metadata } from "next";

import { SosList } from "@/components/crisis/sos-list";
import { sosCountries } from "@/components/patient/sos-orb-server";
import { crisisCountryFor } from "@/lib/crisis/line";
import { sosLinesFor } from "@/lib/crisis/sos";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.sos"), robots: { index: false } };
}
/* Open now or closed is a fact about this minute, so the page is never cached. */
export const dynamic = "force-dynamic";

/**
 * 🔴 F5: THE SOS SHEET WITHOUT JAVASCRIPT.
 *
 * The orb on every patient screen opens its sheet with a state change, which
 * needs scripts. Due diligence found nothing behind it for a reader with
 * scripts off, blocked, or not yet loaded. This page is the same numbers as
 * plain `tel:` links in server-rendered HTML: no sign in, no payment, no
 * script. The orb links here from a `noscript`, and the public footer links
 * here for everybody.
 *
 * The reader's country comes from `?country=`, then their language; a reader
 * we cannot place sees every enabled country's lines, each labelled, beside the
 * sentence that is true everywhere. `getCountries` answers an empty list when
 * the database is down, and the verified table answers then.
 */
export default async function SosPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { t, locale } = await getI18n();
  const asked = (await searchParams).country?.trim().toUpperCase();
  const country = asked && /^[A-Z]{2}$/.test(asked) ? asked : crisisCountryFor({ locale });
  const entries = sosLinesFor({ country, countries: await sosCountries() });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-700">{t("crisis.sheetTitle")}</h1>
        <p className="mt-1 text-[15px] leading-relaxed text-navy-500">{t("crisis.sheetBody")}</p>
        {/* Due diligence: said plainly, so nobody reads the radar or the app as a crisis service. */}
        <p className="mt-2 text-[15px] font-semibold leading-relaxed text-navy-700" data-not-emergency>
          {t("sos.notEmergency")}
        </p>
      </div>
      <SosList
        entries={entries}
        locale={locale}
        words={{
          helpLine: t("crisis.helpLine"),
          anyTime: t("crisis.anyTime"),
          openNow: t("crisis.openNow"),
          closedNow: t("crisis.closedNow"),
          checkHours: t("crisis.checkHours"),
        }}
      />
      <p className="rounded-2xl bg-navy-50 px-3.5 py-3 text-sm leading-relaxed text-navy-600">
        {t("crisis.anywhereElse")}
      </p>
    </main>
  );
}
