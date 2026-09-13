import type { Metadata } from "next";

import { ClinicManagerList } from "@/components/admin/clinic-manager";
import { requireRole } from "@/lib/auth/guard";
import { clinicClinicians, clinicManagersFor } from "@/lib/data/clinic";
import { allClinics } from "@/lib/data/clinic-admin";
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

  const clinics = await allClinics();

  const rows = await Promise.all(
    clinics.map(async (clinic) => {
      const [clinicians, managers] = await Promise.all([
        clinicClinicians(clinic.id),
        clinicManagersFor(clinic.id),
      ]);

      return {
        id: clinic.id,
        name: clinic.name,
        clinicState: clinic.clinicState,
        contactName: clinic.contactName,
        contactEmail: clinic.contactEmail,
        contactPhone: clinic.contactPhone,
        clinicianCount: clinicians.length,
        managers: managers.map((m) => ({ id: m.id, email: m.email, role: m.role })),
      };
    }),
  );

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
