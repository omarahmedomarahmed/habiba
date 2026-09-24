import Link from "next/link";

import type { benefitShortfall } from "@/lib/billing/pot";
import { getI18n } from "@/lib/i18n/server";

/**
 * 🔴 W2-P15 / E5: on the screens that ask for money, why the benefit did not
 * pay and who can change that. A paused or unconfirmed benefit is theirs to
 * fix, so it links to the benefit page; a live one that paid nothing is the
 * organisation's, so it says to ask them. Never a payment error.
 */
export async function BenefitNote({
  shortfall,
}: {
  shortfall: Awaited<ReturnType<typeof benefitShortfall>>;
}) {
  if (!shortfall) return null;
  const { t } = await getI18n();

  return (
    <p
      role="status"
      className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm leading-relaxed text-amber-900"
    >
      {shortfall.state === "unfunded" ? (
        t("pay.askBenefit", { name: shortfall.sponsorName })
      ) : (
        <>
          {shortfall.state === "paused" ? t("benefit.paused") : t("benefit.unverified")}{" "}
          <Link href="/patient/benefit" className="font-semibold underline">
            {t("benefit.confirm")}
          </Link>
        </>
      )}
    </p>
  );
}
