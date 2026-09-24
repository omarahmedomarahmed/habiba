import type { Metadata } from "next";

import { GateSettings } from "@/components/sponsor/gate-settings";
import { Card } from "@/components/ui";
import { MAX_IDENTIFIER_FIELDS } from "@/lib/data/sponsor-admin";
import { identifierFields } from "@/lib/data/sponsors";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { requireSponsor } from "@/lib/sponsor-auth/guard";

export const metadata: Metadata = { title: "How people join", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * How people join. PLAN.md 53.7, 53.8, 53.19b, C236, C238, C247.
 *
 * 🔴 A viewer reads this and changes nothing. The write actions call
 * `requireSponsorAdmin` themselves rather than relying on this page not rendering
 * the controls, because a hidden control is a control somebody reaches with a form
 * post.
 */
export default async function SponsorSettingsPage() {
  const actor = await requireSponsor();
  const { t } = await getI18n();
  const settings = await getSettings();

  const fields = await identifierFields(actor.sponsorId);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">
        {t("sponsor.settingsTitle")}
      </h1>

      {actor.role === "admin" ? (
        <GateSettings
          fields={fields}
          atCap={fields.length >= MAX_IDENTIFIER_FIELDS}
        />
      ) : (
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-slate-600">
            {t("sponsor.identifierBody")}
          </p>
          <ul className="mt-3 space-y-1 text-sm text-slate-800">
            {fields.map((field) => (
              <li key={field.id}>{field.domain ?? field.shapeHint ?? field.kind}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* 🔴 53.19b / C247 — the cycle, and that a pause touches nothing else. */}
      <p className="text-xs leading-relaxed text-slate-500">
        {t("sponsor.verifyCycle", { months: settings.sponsor.verifyCycleMonths })}
      </p>
    </div>
  );
}
