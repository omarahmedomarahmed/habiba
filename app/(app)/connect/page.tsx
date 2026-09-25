import type { Metadata } from "next";

import { HistoryAsks, RedeemInvite } from "@/components/clinical/connect-panel";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guard";
import { asksForTherapist } from "@/lib/data/portability";
import { formatDate, fullName } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.connect"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * Where a clinician meets the patient side of portability. PLAN.md 27.2, 27.7.
 *
 * Two things a patient started: a code they handed over, and a request for the
 * history this clinician holds. Both are on one screen because both are
 * somebody else's initiative arriving, which is a different mental mode from
 * anything else in this product.
 */
export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { locale, t } = await getI18n();
  /* 🔴 Ruling 5 flow 4: the patient's QR opens this page with their code. */
  const code = String((await searchParams).code ?? "").trim().toUpperCase().slice(0, 7);
  const actor = await requireUser();
  const asks = await asksForTherapist(actor.userId);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("portal.connect.title")}
        subtitle={t("portal.connect.subtitle")}
      />
      <div className="space-y-4 px-4 pb-10 sm:px-6">
        <RedeemInvite initialCode={/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(code) ? code : ""} />
        <HistoryAsks
          asks={asks.map((ask) => ({
            id: ask.id,
            name: fullName(ask.firstName, ask.lastName, t("connect.formerPatient")),
            note: ask.note,
            on: formatDate(ask.createdAt, actor.timezone, locale),
          }))}
        />
      </div>
    </div>
  );
}
