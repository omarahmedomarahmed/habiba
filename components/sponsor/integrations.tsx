"use client";

import { useState, useTransition } from "react";

import {
  mintHrKey,
  revokeHrKey,
  setVerification,
} from "@/app/(sponsor)/sponsor/integrations/actions";
import { Button, Card, Field } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

import { ConfirmAct } from "./confirm-act";

/**
 * The HR connection, step by step. PLAN.md 66.2, 66.5 to 66.12, C227, C246.
 *
 * ## 🔴 66.2 — THE SENTENCE IS IN FRONT OF THE SWITCH, NOT AFTER IT
 *
 * > *We never read your directory, never sync it, and never store a staff list.*
 *
 * C227's whole design removed the roster, and this is the one thing in the product
 * that touches employment. An HR admin turning it on has to be able to see, before
 * they do, that it does not do the thing every other HR integration they have ever
 * bought does.
 *
 * ## 🔴 66.6 — NUMBERED, BECAUSE IT GENUINELY IS A SEQUENCE
 *
 * 65.15's rule is that a numbered marker has to encode something true. This one does:
 * step four cannot be done before step three, and the key is generated at the step
 * that needs it rather than on a screen of its own, because a key minted three steps
 * early sits in a clipboard through three steps.
 */

const STEPS: { title: MessageKey; body: MessageKey }[] = [
  { title: "sint.step1", body: "sint.step1Body" },
  { title: "sint.step2", body: "sint.step2Body" },
  { title: "sint.step3", body: "sint.step3Body" },
  { title: "sint.step4", body: "sint.step4Body" },
];

export type HrKeyRow = {
  id: string;
  label: string;
  prefix: string;
  lastSuccessAt: string | null;
  suspendedReason: string | null;
  revoked: boolean;
};

export type DeliveryRow = {
  id: string;
  event: string;
  status: number | null;
  attempts: number;
  error: string | null;
  at: string;
  delivered: boolean;
};

export function SponsorIntegrations({
  canManage,
  enabled,
  hrSystem,
  systems,
  keys,
  deliveries,
}: {
  canManage: boolean;
  enabled: boolean;
  hrSystem: string | null;
  systems: { key: string; name: string }[];
  keys: HrKeyRow[];
  deliveries: DeliveryRow[];
}) {
  const t = useT();
  const [system, setSystem] = useState(hrSystem ?? systems[0]?.key ?? "other");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [minted, setMinted] = useState<string | null>(null);

  /* 🔴 66.7 — live means a call SUCCEEDED. A key that has never answered is not. */
  const live = keys.find((key) => !key.revoked && !key.suspendedReason && key.lastSuccessAt);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("sint.title")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("sint.body")}</p>
      </div>

      {/* ------------------------------------------------------ the switch -- */}
      <Card className="p-5">
        <p className="text-base font-bold tracking-tight text-slate-900">
          {t("sint.enableTitle")}
        </p>

        {/*
          🔴 66.2 — WHAT IT DOES NOT DO, BEFORE THE SWITCH.

          Every HR integration an admin has bought before this one syncs a directory.
          Saying what this one does instead, in front of the control rather than in a
          help page, is the difference between a promise and a footnote.
        */}
        <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
          <p className="font-semibold text-slate-900">{t("sint.neverTitle")}</p>
          <p>{t("sint.neverBody")}</p>
        </div>

        {canManage ? (
          <>
            <div className="mt-4">
              <Field label={t("sint.pickSystem")} htmlFor="hr-system">
                <select
                  id="hr-system"
                  value={system}
                  onChange={(event) => setSystem(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                >
                  {systems.map((candidate) => (
                    <option key={candidate.key} value={candidate.key}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Button
              type="button"
              className="mt-4"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await setVerification(!enabled, system);
                  setError(result.error ?? null);
                })
              }
            >
              {enabled ? t("sint.turnOff") : t("sint.turnOn")}
            </Button>

            {/*
              🔴 WHAT TURNING IT OFF DOES, said beside the button that does it.

              It revokes the keys. A setting that says "off" while a key still answers
              is worse than no setting, and an admin who expects to turn it back on
              tomorrow needs to know they will be minting a new one.
            */}
            {enabled ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{t("sint.offRevokes")}</p>
            ) : null}
          </>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </Card>

      {enabled ? (
        <>
          {/* --------------------------------------------- the indicator -- */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span
                aria-hidden
                className={
                  live
                    ? "h-2.5 w-2.5 rounded-full bg-brand-500"
                    : "h-2.5 w-2.5 rounded-full bg-slate-300"
                }
              />
              <p className="text-sm font-semibold text-slate-900">
                {live ? t("sint.connected") : t("sint.notConnected")}
              </p>
            </div>

            {/*
              🔴 66.7 — THE TIMESTAMP IS THE WHOLE POINT.

              "Connected" on its own is a green dot that means we saved a setting.
              With the time of the last successful answer beside it, an admin whose
              integration broke on Tuesday can see that it did.
            */}
            <p className="mt-1 text-sm text-slate-600">
              {live
                ? t("sint.lastAnswered", { when: live.lastSuccessAt ?? "" })
                : t("sint.neverAnswered")}
            </p>
          </Card>

          {/* ------------------------------------------------- the steps -- */}
          <Card className="p-5">
            <p className="text-base font-bold tracking-tight text-slate-900">
              {t("sint.stepsTitle")}
            </p>

            <ol className="mt-4 space-y-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{t(step.title)}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                      {t(step.body)}
                    </p>

                    {/*
                      🔴 66.6 — THE SNIPPET AT THE STEP THAT USES IT, and the key
                      generated at the step that needs it.
                    */}
                    {i === 1 ? (
                      <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
{`POST https://24therapy.app/api/hr/v1/employment
Authorization: Bearer <your key>
Content-Type: application/json

{ "identifier": "the staff number they typed" }

200 { "active": true, "as_of": "2026-09-14T10:30:00Z" }`}
                      </pre>
                    ) : null}

                    {i === 2 && canManage ? (
                      <div className="mt-2">
                        {minted ? (
                          <div className="rounded-xl bg-brand-50 p-3">
                            <p className="text-xs font-medium text-brand-900">
                              {t("sint.keyOnce")}
                            </p>
                            <p className="mt-1 break-all font-mono text-xs text-brand-900">
                              {minted}
                            </p>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              start(async () => {
                                const result = await mintHrKey();
                                setError(result.error ?? null);
                                setMinted(result.raw ?? null);
                              })
                            }
                          >
                            {t("sint.generateKey")}
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          {/* --------------------------------------------------- the keys -- */}
          {keys.length > 0 ? (
            <Card className="p-5">
              <p className="text-base font-bold tracking-tight text-slate-900">
                {t("sint.keysTitle")}
              </p>
              <ul className="mt-3 divide-y divide-slate-100">
                {keys.map((key) => (
                  <li key={key.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
                    <span className="font-mono text-xs text-slate-700">{key.prefix}…</span>
                    <span className="text-xs text-slate-500">
                      {key.revoked
                        ? t("sint.keyRevoked")
                        : key.suspendedReason
                          ? key.suspendedReason
                          : (key.lastSuccessAt ?? t("sint.keyUnused"))}
                    </span>
                    {canManage && !key.revoked ? (
                      /* W2-S04 — a key stops at once, so ask first and say when it has. */
                      <ConfirmAct
                        className="ms-auto"
                        label={t("sint.revoke")}
                        body={t("sint.revokeBody")}
                        done={t("sint.keyRevoked")}
                        act={() => revokeHrKey(key.id)}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
              {/* 🔴 66.10 — a revoked key is WHY calls stopped working. */}
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                {t("sint.revokedMeans")}
              </p>
            </Card>
          ) : null}

          {/*
            W2-S06 paid for this: the "did not match" count is gone. It counted
            unanswered attestations, which are written only after an enrolment
            SUCCEEDS, so its sentence about failed matches was untrue (W1-21).
          */}

          {/* --------------------------------------------- the deliveries -- */}
          <Card className="p-5">
            <p className="text-base font-bold tracking-tight text-slate-900">
              {t("sint.logTitle")}
            </p>

            {deliveries.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{t("sint.logEmpty")}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-start text-xs uppercase tracking-wide text-slate-500">
                      <th scope="col" className="py-2 pe-4 text-start font-medium">
                        {t("sint.logWhen")}
                      </th>
                      <th scope="col" className="py-2 pe-4 text-start font-medium">
                        {t("sint.logEvent")}
                      </th>
                      <th scope="col" className="py-2 pe-4 text-start font-medium">
                        {t("sint.logStatus")}
                      </th>
                      <th scope="col" className="py-2 text-start font-medium">
                        {t("sint.logError")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((delivery) => (
                      <tr key={delivery.id} className="border-b border-slate-100 last:border-0">
                        <td className="whitespace-nowrap py-2 pe-4 text-slate-600">
                          {delivery.at}
                        </td>
                        <td className="py-2 pe-4 font-mono text-xs text-slate-700">
                          {delivery.event}
                        </td>
                        <td className="py-2 pe-4 tabular-nums text-slate-700">
                          {/* 🔴 Empty, not a dash: C117 bans one and a placeholder
                              glyph for "we never heard back" says less than nothing. */}
                          {delivery.status ?? ""}
                          {delivery.attempts > 1 ? ` ×${delivery.attempts}` : ""}
                        </td>
                        <td className="py-2 text-xs text-red-700">{delivery.error ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 🔴 66.9 — why there is no name in this table, in the table's own words. */}
            <p className="mt-3 text-xs leading-relaxed text-slate-500">{t("sint.logNoNames")}</p>
          </Card>
        </>
      ) : null}
    </div>
  );
}
