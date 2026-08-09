import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { VerificationReview } from "@/components/admin/verification-review";
import { Card } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { reviewQueue } from "@/lib/data/verification";
import { countryFlag, countryName } from "@/lib/geo";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Verifications", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The approval queue.
 *
 * The documents are rendered inline rather than behind a link, because a
 * reviewer comparing a name on a licence to a name on an account should not be
 * opening four tabs per applicant. Their URLs are unguessable and this page is
 * super-admin only.
 */
export default async function VerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  await requireRole("super_admin");
  const { state } = await searchParams;

  const bucket =
    state === "approved" || state === "rejected" ? (state as "approved" | "rejected") : "submitted";

  const rows = await reviewQueue(bucket);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Verifications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Nobody sees a patient through 24Therapy until someone here has looked at their licence.
        </p>
      </div>

      <nav className="flex gap-1">
        {(["submitted", "approved", "rejected"] as const).map((tab) => (
          <a
            key={tab}
            href={`/admin/verifications?state=${tab}`}
            className={
              bucket === tab
                ? "rounded-xl bg-navy-500 px-3.5 py-2 text-sm font-medium text-white"
                : "rounded-xl px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            }
          >
            {tab === "submitted" ? "Waiting" : tab === "approved" ? "Approved" : "Rejected"}
          </a>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Card className="p-8 text-center">
          <ShieldCheck className="mx-auto h-6 w-6 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-slate-900">
            {bucket === "submitted" ? "Nothing waiting" : `Nothing ${bucket}`}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {bucket === "submitted"
              ? "New submissions land here the moment a clinician sends them."
              : "Decisions you make will show up here."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <VerificationReview
              key={row.id}
              id={row.id}
              name={[row.firstName, row.lastName].filter(Boolean).join(" ") || "Unnamed"}
              email={row.email}
              organizationName={row.organizationName}
              countryLabel={
                row.country
                  ? `${countryFlag(row.country)} ${countryName(row.country) ?? row.country}`
                  : "Not given"
              }
              licenseBody={row.licenseBody}
              licenseNumber={row.licenseNumber}
              licenseExpiry={row.licenseExpiry}
              specialties={row.specialties}
              languages={row.languages}
              documents={[
                { label: "ID — front", url: row.idFrontUrl },
                { label: "ID — back", url: row.idBackUrl },
                { label: "Licence", url: row.licenseDocUrl },
                { label: "Headshot (public)", url: row.headshotUrl },
              ]}
              submittedAt={row.submittedAt ? formatDate(row.submittedAt) : null}
              reviewNote={row.reviewNote}
              decided={bucket !== "submitted"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
