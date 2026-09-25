import type { Metadata } from "next";

import { GateSettings } from "@/components/sponsor/gate-settings";
import { StaffList } from "@/components/sponsor/staff-list";
import { emailListSummary } from "@/lib/data/sponsor-email-list";
import { Card } from "@/components/ui";
import { MAX_IDENTIFIER_FIELDS } from "@/lib/data/sponsor-admin";
import { domainProved, domainsFor } from "@/lib/data/sponsor-domains";
import { identifierFields } from "@/lib/data/sponsors";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/utils";
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
  const { t, locale } = await getI18n();
  const settings = await getSettings();

  const [saved, domains, list] = await Promise.all([
    identifierFields(actor.sponsorId),
    domainsFor(actor.sponsorId),
    emailListSummary(actor.sponsorId),
  ]);

  /*
   * 🔴 W2-S06: enrolment admits a domain gate only for a PROVED domain, so a
   * gate naming one that is not proved refuses every employee. Said beside it.
   */
  const fields = saved.map((field) => ({
    ...field,
    unproved:
      field.kind === "domain_email" &&
      !domains.some(
        (row) =>
          row.domain.trim().toLowerCase() === (field.domain ?? "").trim().toLowerCase() &&
          domainProved(row),
      ),
  }));

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
      ) : null}

      {/* 🔴 0162 / ruling 15: the list, once the company has chosen it as a way in. */}
      {actor.role === "admin" && fields.some((field) => field.kind === "listed_email") ? (
        <StaffList
          onList={list.onList}
          lastUpload={list.lastUpload ? formatDate(list.lastUpload, "UTC", locale) : null}
          graceDays={settings.rules.enrolment.listRemovalGraceDays}
        />
      ) : null}

      {actor.role === "admin" ? null : (
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
