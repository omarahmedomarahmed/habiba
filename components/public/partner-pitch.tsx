import Link from "next/link";

import { btn } from "@/components/public/site-ui";
import { Card } from "@/components/ui";
import type { MessageKey } from "@/lib/i18n/messages";
import { getI18n } from "@/lib/i18n/server";
import { PARTNER_APPLY } from "@/lib/routing";
import { cn } from "@/lib/utils";

/**
 * The partner offer in one section, on /developers and /integrations.
 *
 * Every row names a route that exists under app/api/partner/v1, so the list
 * cannot promise an endpoint we do not have. White label and other
 * specialties are said to be next, never available.
 */
const CAPABILITIES: { key: string; route: string }[] = [
  { key: "consent", route: "POST /api/partner/v1/consent" },
  { key: "sessions", route: "POST /api/partner/v1/sessions" },
  { key: "audio", route: "POST /api/partner/v1/sessions/<ref>/media" },
  { key: "note", route: "GET /api/partner/v1/sessions/<ref>/note" },
  { key: "memory", route: "GET /api/partner/v1/subjects/<ref>/memory" },
  { key: "copilot", route: "POST /api/partner/v1/copilot" },
  { key: "launch", route: "POST /api/partner/v1/launch" },
];

export async function PartnerPitch({ heading = true }: { heading?: boolean }) {
  const { t } = await getI18n();
  const key = (name: string) => `devs.offer.${name}` as MessageKey;

  return (
    <section aria-labelledby={heading ? "partner-pitch" : undefined} className="min-w-0">
      {heading ? (
        <>
          <h2 id="partner-pitch" className="text-balance text-[28px] font-bold tracking-tight text-navy-700 sm:text-[34px]">
            {t("devs.offer.title")}
          </h2>
          <p className="mt-3 max-w-2xl text-pretty text-[17px] leading-relaxed text-navy-500">{t("devs.offer.body")}</p>
        </>
      ) : null}
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {CAPABILITIES.map((item) => (
          <li key={item.key} className="min-w-0">
            <Card className="h-full rounded-[20px] border-navy-100 p-5">
              <p className="font-semibold text-navy-700">{t(key(`cap.${item.key}`))}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-navy-500">{t(key(`cap.${item.key}Body`))}</p>
              <p dir="ltr" className="mt-2 overflow-x-auto whitespace-nowrap text-start font-mono text-xs text-slate-600">
                {item.route}
              </p>
            </Card>
          </li>
        ))}
      </ul>
      <p className="mt-6 font-semibold text-navy-700">{t("devs.offer.next")}</p>
      <p className="mt-1 text-[15px] leading-relaxed text-navy-500">{t("devs.offer.keys")}</p>
      <Link href={PARTNER_APPLY} className={cn(btn.primary, btn.lg, "mt-6")}>
        {t("devs.offer.apply")}
      </Link>
    </section>
  );
}
