import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { VerificationReview } from "@/components/admin/verification-review";
import { Card } from "@/components/ui";
import { requireStaff } from "@/lib/auth/guard";
import {
  IDENTITY_KINDS,
  IDENTITY_LABEL,
  identityDocumentPath,
  type IdentityKind,
} from "@/lib/documents/identity-access";
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
 * opening four tabs per applicant.
 *
 * 🔴 29.1 — what they are rendered FROM changed. It used to be the stored blob
 * URL, which is a secret and therefore not access control (H14): a screenshot
 * of this page handed whoever received it a permanent, unrevocable, unaudited
 * copy of a stranger's passport. Each image now points at
 * `/api/uploads/<verification>.<kind>`, which carries no secret and asks who
 * is calling on every request. "This page is super-admin only" was true and
 * was never the thing protecting the file.
 */
/**
 * Which columns exist on the row, so an absent document is not offered as a
 * broken link. 29.1.
 */
const URL_OF: Record<IdentityKind, (row: QueueRow) => string | null> = {
  idFront: (row) => row.idFrontUrl,
  idBack: (row) => row.idBackUrl,
  licenseDoc: (row) => row.licenseDocUrl,
  headshot: (row) => row.headshotUrl,
};

type QueueRow = Awaited<ReturnType<typeof reviewQueue>>[number];

export default async function VerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const actor = await requireStaff();
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
              /*
               * 🔴 29.1 / H14 — the reference, never the stored URL.
               *
               * These four lines used to put a blob URL for a real person's
               * passport into the HTML of an admin page. A URL in a page stops
               * being a secret the moment the page is screenshotted, forwarded
               * or pasted into a support ticket, and a blob URL is the only
               * thing that was protecting the file.
               *
               * `identityDocumentPath` carries no secret at all: the route
               * asks who is calling on every request and audits before the
               * bytes. The "(public)" on the headshot is gone too, because it
               * was describing a different column (`therapist_radar.photo_url`)
               * and telling a reviewer to treat this one casually.
               */
              documents={IDENTITY_KINDS.filter((kind) => URL_OF[kind](row) !== null).map(
                (kind) => ({
                  label: IDENTITY_LABEL[kind],
                  url: identityDocumentPath(row.id, kind),
                }),
              )}
              submittedAt={row.submittedAt ? formatDate(row.submittedAt, actor.timezone, "en") : null}
              reviewNote={row.reviewNote}
              decided={bucket !== "submitted"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
