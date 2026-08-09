import type { Metadata } from "next";

import { ClinicianRow } from "@/components/admin/clinician-row";
import { Card } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { listClinicians } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Clinicians", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminTherapistsPage() {
  await requireRole("super_admin");
  const clinicians = await listClinicians();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clinicians</h1>
        <p className="mt-1 text-sm text-slate-500">
          Verification is a signal, not a gate — an unverified clinician can still record sessions.
        </p>
      </div>

      <Card className="divide-y divide-slate-100">
        {clinicians.map((clinician) => (
          <ClinicianRow
            key={clinician.id}
            id={clinician.id}
            name={`${clinician.firstName} ${clinician.lastName}`.trim()}
            email={clinician.email}
            organizationName={clinician.organizationName}
            role={clinician.role}
            status={clinician.status}
            verificationStatus={clinician.verificationStatus}
            plan={clinician.plan ?? "payg"}
            sessionCount={clinician.sessionCount}
          />
        ))}
        {clinicians.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No clinicians yet.</p>
        ) : null}
      </Card>
    </div>
  );
}
