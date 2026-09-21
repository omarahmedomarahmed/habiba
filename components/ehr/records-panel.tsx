"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Card, Field, Input } from "@/components/ui";
import { EHR_VENDORS } from "@/lib/db/schema";
import { VENDORS } from "@/lib/ehr/vendors";
import { useT } from "@/lib/i18n/client";

/**
 * The records connection, in one component. PLAN.md 43.1c, 43.4, C266.
 *
 * ## 🔴 43.1c — "SAME FLOW, TWO HOMES" IS ONE COMPONENT, NOT TWO SCREENS THAT AGREE
 *
 * A clinic manager reaches this from the clinic portal and a solo clinician from settings. Both
 * render this file, both post to the same actions, and both own the connection through the same
 * `organizationId`. Two components would be two places for C266 to be got wrong, and the second
 * one would be written by somebody who had not read the first.
 *
 * The only thing that differs is one sentence, because the sentence is the point: a clinic manager
 * is told the connection belongs to the practice and a departing clinician loses it; a solo
 * clinician is told it belongs to their practice, which is them. Those are the same sentence about
 * an organisation that happens to have one person in it, and a therapist who later joins a
 * practice needs to have been told which it was.
 *
 * ## 🔴 43.4's DECISION IS ON THIS SCREEN, BEFORE THE CONNECT BUTTON
 *
 * What we read, what we never read, what we keep and what happens on a disconnection. A hospital's
 * integration team decides whether that is acceptable here, in one screen, rather than three weeks
 * into an onboarding — the same placement sprint 54 used for C267 and C261 and sprint 55 for C255.
 */

/**
 * 🔴 43.3 — a filing's state, for the screen that answers "did the note land".
 *
 * This list is not decoration. `ehr_writebacks` records the attempt before the request precisely so
 * a refused filing is visible, and a table nobody renders makes that recording pointless: the whole
 * failure this sprint must avoid is a clinician who has moved on, a chart with a gap, and nobody
 * knowing. The screen is the half that makes the row worth writing.
 */
export type FilingRow = {
  id: string;
  state: string;
  lastError: string | null;
  createdAt: string;
  /** 🔴 67.5 — what their server returned, and whose note it was. */
  responseStatus: number | null;
  approvedBy: string | null;
};

export type ConnectionRow = {
  id: string;
  vendor: string;
  tenantLabel: string | null;
  connectedAt: string;
  /** 🔴 67.4 — when a call to their server last returned something. */
  lastSuccessAt: string | null;
  lastError: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

export type PanelActions = {
  begin: (prev: { error?: string }, formData: FormData) => Promise<{ error?: string }>;
  disconnect: (formData: FormData) => Promise<void>;
};

export function RecordsPanel({
  connections,
  filings,
  isClinic,
  configured,
  missing,
  onClinicPlan,
  filers,
  actions,
}: {
  connections: ConnectionRow[];
  filings: FilingRow[];
  /** Which of the two sentences to show. The only difference between the two homes. */
  isClinic: boolean;
  configured: boolean;
  missing: string;
  /**
   * 🔴 67.1 — ON THE CLINIC PLAN, AND A SOLO PRACTICE IS TOLD WHY.
   *
   * *Not shown a disabled button.* A records connection binds an ORGANISATION to a
   * hospital system: the registration is the practice's, the token is the practice's,
   * and a departing clinician loses it because it was never theirs. A solo practice
   * with one clinician is the case where `lib/data/portability.ts`'s export is the
   * right tool, and that is what the sentence says instead of a greyed control.
   */
  onClinicPlan: boolean;
  /** 🔴 67.7 — how many clinicians file through this, before they disconnect. */
  filers: number;
  actions: PanelActions;
}) {
  const t = useT();
  const [state, beginAction] = useActionState(actions.begin, {});
  const [open, setOpen] = useState(false);

  const live = connections.filter((c) => c.revokedAt === null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("records.title")}</h1>
        {/* 🔴 C266, in the copy. One sentence, two audiences, one meaning. */}
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {isClinic ? t("records.bodyClinic") : t("records.bodySolo")}
        </p>
      </div>

      {/*
        🔴 67.1 — THE UPSELL SAYS WHAT TO DO INSTEAD, which is what makes it not an
        upsell. A disabled button tells somebody they are missing something; this
        tells them the thing they actually want exists on the plan they are on.
      */}
      {!onClinicPlan ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-900">{t("records.planTitle")}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("records.planBody")}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("records.planInstead")}</p>
        </Card>
      ) : live.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-slate-600">{t("records.none")}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {live.map((connection) => (
            <li key={connection.id}>
              <Card className="p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {t("records.connected", {
                    tenant:
                      connection.tenantLabel ??
                      VENDORS[connection.vendor as keyof typeof VENDORS]?.name ??
                      connection.vendor,
                  })}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t("records.connectedOn", { date: connection.connectedAt })}
                </p>

                {/*
                  🔴 67.4 — CONNECTED MEANS A TOKEN THAT WORKS.

                  The line above is when the OAuth exchange completed and says nothing
                  about whether the token still works: a hospital rotating a client
                  secret leaves it exactly where it is while every filing fails. This
                  is the last time a call to their server actually returned something,
                  and the error beside it is what it said when one did not.
                */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    aria-hidden
                    className={
                      connection.lastSuccessAt
                        ? "h-2 w-2 rounded-full bg-brand-500"
                        : "h-2 w-2 rounded-full bg-slate-300"
                    }
                  />
                  <span className="text-xs text-slate-600">
                    {connection.lastSuccessAt
                      ? t("records.lastAnswered", { when: connection.lastSuccessAt })
                      : t("records.neverAnswered")}
                  </span>
                </div>

                {/* 🔴 67.6 — a failed call is a CLINICAL fact, not an infrastructure detail. */}
                {connection.lastError ? (
                  <p className="mt-1 text-xs leading-relaxed text-red-600">
                    {connection.lastError}
                  </p>
                ) : null}

                <form action={actions.disconnect} className="mt-3">
                  <input type="hidden" name="connectionId" value={connection.id} />
                  <button
                    type="submit"
                    className="tap-target h-9 rounded-xl px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    {t("records.disconnect")}
                  </button>

                  {/*
                    🔴 67.7 — WHAT STOPS FILING, AS A NUMBER, BEFORE THE PRESS.

                    A practice manager pressing this is deciding something about every
                    clinician on the account. "12 clinicians file notes through this"
                    is the fact that decides it; without the count the button reads as
                    undoing a setting.
                  */}
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    {filers > 0
                      ? t("records.disconnectCount", { count: filers })
                      : t("records.disconnectNone")}
                  </p>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/*
       * 🔴 43.4, BEFORE the Connect button rather than after it.
       *
       * Three paragraphs: what we read and never read, what we keep and on whose schedule, and
       * what a disconnection does. Each one is a promise the schema keeps rather than a policy.
       */}
      <Card className="space-y-2 p-5 text-sm leading-relaxed text-slate-600">
        <p>{t("records.whatWeHold")}</p>
        <p>{t("records.whatWeKeep")}</p>
        <p>{t("records.severOnDisconnect")}</p>
      </Card>

      {!configured ? (
        /*
         * 🔴 The screen says which half is missing, rather than offering a button that fails.
         *
         * `lib/integrations/registry.ts` exists because of screens that promise what they cannot
         * do; `features.ehr` is both halves, and this is where the missing one is named.
         */
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm leading-relaxed text-amber-900/90">
            {t("records.notConfigured", { missing })}
          </p>
        </Card>
      ) : open ? (
        <Card className="p-5">
          <form action={beginAction} className="space-y-4">
            <Field label={t("records.vendor")} htmlFor="ehr-vendor">
              <select
                id="ehr-vendor"
                name="vendor"
                defaultValue="epic"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              >
                {EHR_VENDORS.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {VENDORS[vendor].name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("records.baseUrl")} htmlFor="ehr-base-url">
              {/* `type="url"` and a database CHECK behind it: https only, sandbox included. */}
              <Input id="ehr-base-url" name="fhirBaseUrl" type="url" required />
            </Field>

            {/*
             * 🔴 What may stop this, in the vendor's own terms, on the form.
             *
             * Every one of these is a thing nobody here controls, and an operator who reads it
             * before trying does not open a support ticket about it afterwards.
             */}
            <ul className="space-y-1">
              {EHR_VENDORS.map((vendor) => (
                <li key={vendor} className="text-xs leading-relaxed text-slate-500">
                  <span className="font-semibold">{VENDORS[vendor].name}:</span>{" "}
                  {VENDORS[vendor].mayBeBlocked}
                </li>
              ))}
            </ul>

            {state.error ? (
              <p role="alert" className="text-xs text-red-600">
                {state.error}
              </p>
            ) : null}

            <Submit label={t("records.begin")} />
          </form>
        </Card>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {t("records.connect", { name: VENDORS.epic.name })}
        </Button>
      )}

      {/*
       * 🔴 43.3 — the filings, and a REFUSED one shows its reason.
       *
       * The reason is the hospital's own words, passed through from the FHIR response status,
       * because the person reading it is on a call with an integration team and "422" is the whole
       * answer they need. It carries no note text: `session_notes` is the note, and this row has
       * never held a copy (see `ehr_writebacks` in the schema).
       */}
      {filings.length > 0 ? (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("records.filings")}
          </p>
          <ul className="mt-2 divide-y divide-slate-100">
            {filings.map((filing) => (
              <li key={filing.id} className="py-2">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span
                    className={
                      filing.state === "filed"
                        ? "text-xs font-semibold text-brand-700"
                        : filing.state === "refused"
                          ? "text-xs font-semibold text-red-600"
                          : "text-xs font-semibold text-amber-700"
                    }
                  >
                    {filing.state === "filed"
                      ? t("records.filed")
                      : filing.state === "refused"
                        ? t("records.refused")
                        : t("records.pending")}
                  </span>
                  <span className="text-xs text-slate-500">{filing.createdAt}</span>
                  {/*
                    🔴 67.5 — THE STATUS AND THE CLINICIAN.

                    The person reading this is on a call with an integration team, and
                    "422" is the whole answer they need. The clinician is the other
                    half: a failed filing means somebody's note is not in the hospital
                    chart, and that person has to be told.
                  */}
                  {filing.responseStatus !== null ? (
                    <span className="font-mono text-xs tabular-nums text-slate-500">
                      {filing.responseStatus}
                    </span>
                  ) : null}
                  {filing.approvedBy ? (
                    <span className="text-xs text-slate-500">{filing.approvedBy}</span>
                  ) : null}
                </div>
                {filing.lastError ? (
                  <p className="mt-0.5 text-xs text-red-600">{filing.lastError}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : connections.some((c) => c.revokedAt === null) ? (
        <Card className="p-4">
          <p className="text-sm text-slate-600">{t("records.filingsEmpty")}</p>
        </Card>
      ) : null}

      {/* The disconnected ones, kept because a filing through a removed connection must still be
          explainable a year later. */}
      {connections.some((c) => c.revokedAt !== null) ? (
        <div className="space-y-1">
          {connections
            .filter((c) => c.revokedAt !== null)
            .map((connection) => (
              <p key={connection.id} className="text-xs text-slate-500">
                {t("records.revoked", { date: connection.revokedAt ?? "" })}
                {connection.revokedReason
                  ? ` ${t("records.revokedWhy", { reason: connection.revokedReason })}`
                  : ""}
              </p>
            ))}
        </div>
      ) : null}
    </div>
  );
}
