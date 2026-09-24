import type { Metadata } from "next";

import { MailCheck } from "@/components/admin/mail-check";
import { VideoCheck } from "@/components/admin/video-check";
import { previewMessages, previewRoster } from "@/lib/mail-previews";
import { TransferFieldsEditor } from "@/components/admin/transfer-fields-editor";
import { detailsLockedBy } from "@/lib/billing/manual";
import {
  CopilotEditor,
  CountryEditor,
  PayoutsEditor,
  TeamEditor,
  PricingEditor,
  SessionEditor,
} from "@/components/admin/settings-editor";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { formatUsd } from "@/lib/billing/plans";
import { tractionMetrics } from "@/lib/data/vault";
import { getCountries, getSettings } from "@/lib/settings";
import { hasNoRail } from "@/lib/settings/defs";
import { whatTheRailNeeds } from "@/lib/billing/egypt";
import { countriesMissingACrisisLine } from "@/lib/crisis/line";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";
/*
 * 🔴 77.14 — the mail check paces fourteen sends at 150ms with a retry, so the
 * action can run for ten seconds or so. The default ceiling would cut it off
 * partway through and report a count that is a story about a timeout.
 */
export const maxDuration = 60;

/**
 * Every number in the product, edited by a person. PLAN.md 20.1–20.7.
 *
 * ## 🔴 Why this is the owner's screen and not staff's
 *
 * 20.8 splits the back office three ways, and this is the half that prices the
 * product: a rate here changes what every clinician is billed and what the
 * public pricing page says on its next request. Staff work queues; they do not
 * move prices.
 *
 * ## 20.7 — the Total View, on the same page as the levers
 *
 * The margin per session, measured from real model spend, sits at the top of
 * the screen where the rates are edited. Splitting them across two pages is
 * how a platform ends up with a price nobody has compared to its cost since
 * the day it was set.
 */
export default async function SettingsPage() {
  await requireRole("super_admin");

  const [settings, countries, traction, inFlight] = await Promise.all([
    getSettings(),
    getCountries(),
    tractionMetrics(),
    /* 🔴 73.11 — how many payers are mid-transfer, which locks the details below. */
    detailsLockedBy(),
  ]);

  const unreachable = countries.filter(hasNoRail);

  /* 🔴 64.1 — what the Egyptian rail is waiting for, which is paperwork not code. */
  const railNeeds = whatTheRailNeeds();

  /*
   * 🔴 21R.8 / C98 / 0088 — WHERE A PERSON IN CRISIS GETS A SENTENCE, NOT A NUMBER.
   *
   * `lib/crisis/line.ts` carried this as a warning about itself for four
   * sprints and nothing acted on it, because a paragraph in a module is read by
   * whoever opens that module. This is the same fact on a screen somebody opens
   * every week, beside the country that needs it.
   */
  const noCrisisLine = countriesMissingACrisisLine(
    countries.map((c) => ({
      code: c.code,
      name: c.name,
      enabled: c.enabled,
      crisisLineTel: c.crisisLineTel,
    })),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        subtitle="Every figure the product charges, shows or enforces. There is no second copy."
      />

      {/* 🔴 20.6 / 20.7 — the margin, from real usage, beside the rates. */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Margin per session, last 30 days</p>
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Revenue" value={formatUsd(traction.revenuePerSessionCents)} />
          <Stat label="Model cost" value={formatUsd(traction.costPerSessionCents)} />
          <Stat label="Margin" value={formatUsd(traction.marginPerSessionCents)} strong />
          <Stat
            label="Margin %"
            value={
              traction.marginBps === null
                ? "-"
                : `${(traction.marginBps / 100).toFixed(1)}%`
            }
          />
        </dl>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Cost is what the models charged. Absent, not zero, when nothing was collected.
        </p>
      </Card>

      {unreachable.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            {unreachable.length} countr{unreachable.length === 1 ? "y has" : "ies have"} no rail
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
            {unreachable.map((c) => c.name).join(", ")}, nobody there can pay us and nobody there
            can be paid. A clinician who signs up in one of these is a person we cannot pay, not a
            gap in a spreadsheet.
          </p>
        </Card>
      ) : null}

      {noCrisisLine.length > 0 ? (
        <Card className="border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">
            {noCrisisLine.length} enabled countr{noCrisisLine.length === 1 ? "y has" : "ies have"}{" "}
            no crisis line
          </p>
          {/*
            🔴 C349's sweep, applied here: the sentence "a wrong number looks
            like help, presses like help and does nothing" was on this screen
            TWICE, once here and once beside the field an operator types the
            number into. The second one is the one they read while typing, so it
            stays and this one goes. Nothing is lost and a paragraph is.
          */}
          <p className="mt-1 text-sm leading-relaxed text-red-900/90">
            {noCrisisLine.map((c) => c.name).join(", ")}. Until somebody dials one and enters it
            below, a person in crisis there is shown &ldquo;call your local emergency
            number&rdquo;, which is true and is not a number.
          </p>
        </Card>
      ) : null}

      {/*
        🔴 64.1 — WHAT THE EGYPTIAN RAIL IS WAITING FOR, ON THE SCREEN.

        Sprint 64 is blocked on a licensed entity, a merchant account and a signed
        gateway contract. That is a fact about paperwork rather than about code, and
        the person who can clear it reads this screen: discovering it when somebody in
        Cairo tries to pay is the failure this card exists to prevent.

        `whatTheRailNeeds` returns an empty list when both are configured, so this
        disappears the day the contract lands rather than becoming a stale banner.
      */}
      {railNeeds.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Egypt has no payment rail yet
          </p>
          <ul className="mt-1 space-y-1 text-sm leading-relaxed text-amber-900/90">
            {railNeeds.map((need) => (
              <li key={need}>{need}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm leading-relaxed text-amber-900/90">
            Until then an Egyptian patient pays by transfer and the therapist is on the manual
            payout queue.
          </p>
        </Card>
      ) : null}

      <PricingEditor
        tiers={settings.pricing.tiers}
        creditExpiryMonths={settings.pricing.creditExpiryMonths}
      />
      <SessionEditor {...settings.session} />
      <CopilotEditor {...settings.copilot} />
      <PayoutsEditor {...settings.payouts} />
      {/* 🔴 75.5 — the queues above are worked by people who need an account. */}
      <TeamEditor />
      {/*
        🔴 73.11 — beside the gateway key, because it is the same decision:
        how money reaches us from Egypt. The day a gateway arrives, one of these
        two is switched off and the other is not.
      */}
      <TransferFieldsEditor
        fields={settings.payouts.transferFields}
        cardsComingSoon={settings.payouts.cardsComingSoon}
        inFlight={inFlight}
      />

      {/*
        🔴 77.12 — on the owner's screen, beside the other levers nobody else
        may touch. It sends fourteen emails, which is the kind of button that
        belongs behind the same door as the prices.
      */}
      <MailCheck roster={previewRoster(previewMessages())} />

      {/*
        🔴 79.1 — beside the email check, and for the same reason: the two
        credentials this product cannot work without are both write-only on
        Vercel, so the only honest way to know either one works is to use it.
      */}
      <VideoCheck />

      <div>
        <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-500 uppercase">
          Countries
        </h2>
        <div className="space-y-3">
          {countries.map((country) => (
            <CountryEditor
              key={country.code}
              country={{ ...country, noRail: hasNoRail(country) }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={strong ? "text-lg font-bold text-slate-900" : "text-lg text-slate-700"}>
        {value}
      </dd>
    </div>
  );
}
