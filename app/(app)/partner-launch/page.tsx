import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import { getI18n } from "@/lib/i18n/server";
import { launchScopePatients } from "@/lib/partner/launch-scope";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("plaunch.title"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 F6: WHERE A PARTNER-OPENED SESSION LANDS, AND ALL IT CAN SEE.
 *
 * This clinician's patients who linked themselves to the partner that opened
 * the session, and nobody else. The session is fifteen minutes, read only, and
 * reaches nothing but this list and those charts (`lib/partner/launch-scope.ts`).
 * A clinician signed in the ordinary way has no use for this page.
 */
export default async function PartnerLaunchPage() {
  const actor = await requireUser();
  if (!actor.partnerScope) redirect("/dashboard");
  const { t } = await getI18n();
  const patients = await launchScopePatients({ partnerId: actor.partnerScope.partnerId, userId: actor.userId });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] leading-tight font-bold tracking-tight text-navy-700">{t("plaunch.title")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-navy-400">{t("plaunch.body")}</p>
      </div>
      {patients.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-sm text-navy-400 ring-1 ring-navy-100">{t("plaunch.empty")}</p>
      ) : (
        <ul className="divide-y divide-navy-100 rounded-2xl bg-white ring-1 ring-navy-100">
          {patients.map((patient) => (
            <li key={patient.id}>
              <Link
                href={`/patients/${patient.id}`}
                className="tap-target flex px-5 py-3 text-sm font-semibold text-navy-700 hover:bg-navy-50"
              >
                {patient.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
