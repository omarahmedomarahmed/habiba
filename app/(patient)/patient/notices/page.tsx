import type { Metadata } from "next";

import { PatientNotices } from "@/components/patient/notices";
import { PatientBack } from "@/components/patient/back";
import { noticesFor } from "@/lib/data/notices";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "What has happened", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The patient's own notification log. PLAN.md 53.20, C231.
 *
 * ## 🔴 Why this table is net new and could not be borrowed
 *
 * `notifications` is keyed to `users.id`, which is the clinician and staff
 * table. Patients live in `patients` and `people` and authenticate through
 * `patient_auth_sessions`, so there was nothing to reuse.
 *
 * ## 🔴 Append only, and TWO logs (C231 amended)
 *
 * *A permanently undeletable entry saying an employer enrolled you and later
 * removed you is a fact about the EMPLOYMENT RELATIONSHIP, retained forever in a
 * record C234 promises the payer cannot touch, and it travels if the record is
 * ever exported.*
 *
 * So this log keeps what happened to the PERSON, and a removal reads "your
 * benefit has ended" with no employer named and no reason. The payer's act lives
 * in `audit`, where it already belongs, and never enters a patient export.
 *
 * Dismissing takes an entry out of the main view and leaves it here, which is
 * what an audit needs and what a person expects.
 */
export default async function NoticesPage() {
  const actor = await requirePatient();
  const { t, locale } = await getI18n();

  const notices = await noticesFor(actor.personId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <div className="flex items-center gap-1">
        <PatientBack />
      </div>

      <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("pnotice.title")}</h1>

      <PatientNotices
        notices={notices.map((notice) => ({
          id: notice.id,
          messageKey: notice.messageKey,
          when: formatDate(notice.createdAt, actor.timezone, locale),
          dismissed: notice.dismissedAt !== null,
        }))}
      />
    </main>
  );
}
