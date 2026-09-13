import type { Metadata } from "next";

import { ClinicJoinForm } from "@/components/clinic/join-form";
import { Card } from "@/components/ui";
import { resolveInvitation } from "@/lib/data/clinic-admin";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "You have been invited", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The invited clinician's screen. PLAN.md 54.5, 54.6, C261, C267.
 *
 * ## 🔴 IT IS AN OPEN ROUTE, AND WHO READS IT IS THE REASON
 *
 * Listed in `lib/routing.ts` as open inside `/clinic` because the person opening this
 * link is NOT a clinic manager and never will be: they are about to become an ordinary
 * clinician. Bouncing them to a manager's sign-in would be the product telling an
 * invited therapist to log in as their employer.
 *
 * ## 🔴 RENDERING THIS PAGE IS WHAT STAMPS `terms_shown_at` (C261)
 *
 * `resolveInvitation` does it, and the database refuses an acceptance on a row where it
 * is null. So "stated in the invitation, before they accept" is enforced by a constraint
 * on the order of two writes rather than by a component remembering a paragraph.
 *
 * It is not proof anybody read it. Nothing is. It is proof we said it, in a column an
 * auditor can read, which is the strongest thing software can offer here.
 */
export default async function ClinicJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { t } = await getI18n();
  const { token } = await params;

  const invitation = await resolveInvitation(token);

  if (!invitation) {
    return (
      <div className="mx-auto max-w-md py-8">
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-slate-600">{t("clinic.join.expired")}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-4">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">
        {t("clinic.join.title", { name: invitation.clinicName })}
      </h1>

      <ClinicJoinForm
        token={token}
        clinicName={invitation.clinicName}
        firstName={invitation.firstName}
        lastName={invitation.lastName}
      />

      {/* 🔴 C267 — they verify themselves, and the practice cannot do it for them. */}
      <p className="text-xs leading-relaxed text-slate-500">{t("clinic.cannotVerify")}</p>
    </div>
  );
}
