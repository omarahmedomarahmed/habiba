import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui";
import { landingFor } from "@/lib/admin/access";
import { requireStaff } from "@/lib/auth/guard";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Not yours", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-A01 / A5: where a back office refusal lands.
 *
 * "A staff account is refused a founder-only screen and redirected rather than
 * shown an error, and the refusal is on the record." The record is written by
 * `requireRole` before the redirect; this page only has to be somewhere the
 * person can use, which the old destination (`/dashboard`, then `/onboarding`)
 * was not.
 */
export default async function NotYoursPage() {
  const actor = await requireStaff();
  const { t } = await getI18n();

  return (
    <Card className="mx-auto mt-6 max-w-md p-5 text-sm text-slate-700">
      <p>{t("aaccess.notYours")}</p>
      <Link href={landingFor(actor.role)} className="mt-3 inline-block font-semibold text-brand-600 hover:underline">
        {t("aaccess.back")}
      </Link>
    </Card>
  );
}
