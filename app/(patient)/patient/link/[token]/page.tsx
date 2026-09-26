import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/patient/kit";
import { LinkConfirm } from "@/components/patient/link-confirm";
import { getI18n } from "@/lib/i18n/server";
import { subjectLinkPreview } from "@/lib/partner/subject-link";
import { requirePatient } from "@/lib/patient-auth/guard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourRecord"), robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 Board 932 — a platform the patient uses asks to write the sessions it
 * holds with them into their record here. Shown to the signed-in patient only
 * (middleware sends anybody else to sign in and back), with the platform's
 * name and nothing the platform sent about them.
 */
export default async function LinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [actor, preview, { t }] = await Promise.all([requirePatient(), subjectLinkPreview(token), getI18n()]);

  const done = preview?.personId === actor.personId;
  const dead = !preview || (preview.personId !== null && !done);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-5 pt-16 pb-10">
      <Card className="p-5">
        {dead ? (
          <>
            <p className="text-sm font-semibold text-navy-700">{t("pinvite.usedTitle")}</p>
            <p className="mt-1 text-sm leading-relaxed text-navy-400">{t("plink.deadBody")}</p>
            <Link
              href="/patient"
              className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-navy-50 text-sm font-semibold text-navy-600"
            >
              {t("tab.home")}
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-navy-700">{t("plink.title", { name: preview.partnerName })}</p>
            <p className="mt-1 text-sm leading-relaxed text-navy-400">{t("plink.body", { name: preview.partnerName })}</p>
            {done ? (
              <p className="mt-4 text-sm font-semibold text-brand-700">{t("plink.done")}</p>
            ) : (
              <LinkConfirm token={token} />
            )}
          </>
        )}
      </Card>
    </main>
  );
}
