import Link from "next/link";

import { SosOrbServer } from "@/components/patient/sos-orb-server";
import { Button } from "@/components/ui";
import { crisisCountryFor } from "@/lib/crisis/line";
import { getI18n } from "@/lib/i18n/server";

/**
 * 🔴 W3: ONE NOT-FOUND FOR EVERY ROUTE GROUP, AND IT KEEPS THE SOS ORB.
 *
 * `notFound()` inside a group rendered the root page, outside that group's
 * layout, so a clinician lost their navigation and a patient lost their way
 * back. Each group's `not-found.tsx` renders this inside its own layout, with a
 * door to that group's home. The orb is here unless the group's layout already
 * draws one (the patient app's chrome), because two orbs is one too many.
 */
export async function RouteNotFound({
  home = "/",
  withOrb = true,
}: {
  home?: string;
  withOrb?: boolean;
}) {
  const { locale, t } = await getI18n();

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-semibold text-brand-700">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{t("nf.title")}</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">{t("nf.body")}</p>
      <Link href={home} className="mt-6">
        <Button>{t("nf.back")}</Button>
      </Link>
      {withOrb ? <SosOrbServer country={crisisCountryFor({ locale })} /> : null}
    </div>
  );
}
