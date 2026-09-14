import type { Metadata } from "next";

import { ClinicManagerList } from "@/components/admin/clinic-manager";
import { requireRole } from "@/lib/auth/guard";
import { clinicsForAdmin } from "@/lib/data/clinic-admin";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Clinics", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Practices. PLAN.md 54.3, C259, C267.
 *
 * 🔴 The clinician COUNT rather than the list, and `clinicClinicians` is called only for
 * its length. An operator needs to know whether an onboarding stalled; a list is what
 * somebody screenshots for the customer who asked for it.
 */
export default async function AdminClinicsPage() {
  await requireRole("super_admin");
  const { t } = await getI18n();

  /*
   * 🔴 63.4 / C325 — THROUGH THE BACK OFFICE'S OWN DOOR, NOT THE CLINIC'S.
   *
   * This used to call `clinicClinicians` and `clinicManagersFor` with a bare
   * organisation id. Those now take a `ClinicPrincipal` and check a capability on
   * the resource, and a `super_admin` is not one: giving this page a synthetic
   * principal with every capability would make the check satisfiable by an object
   * literal, which is the check gone. `clinicsForAdmin` is our own read, with its
   * own select list, behind `requireRole` above.
   */
  const rows = await clinicsForAdmin();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">{t("aclinic.title")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("aclinic.body")}</p>
      </div>

      <ClinicManagerList clinics={rows} />
    </div>
  );
}
