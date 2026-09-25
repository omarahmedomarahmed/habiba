"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { addManager, setRegion, setState } from "@/app/(admin)/admin/clinics/actions";
import { ConfirmWithReason } from "@/components/admin/confirm-with-reason";
import { Button, Card, Field, Input } from "@/components/ui";
import { CLINIC_STATES } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button size="sm" type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

/**
 * Managing practices. PLAN.md 54.3, C259, C267.
 *
 * ## 🔴 WHAT IS NOT ON THIS SCREEN
 *
 * No clinician list, no patient, no session, no schedule. An operational screen about a
 * commercial account has no business listing the people inside a practice's tenancy, and
 * the count is a count: a number is what an operator needs to know whether an onboarding
 * stalled, and a list is what somebody screenshots for the customer who asked.
 *
 * 🔴 And no verification control. C267 says the clinic's word is not evidence; it does
 * not make ours evidence either. Verification runs through `/admin/verifications` against
 * a document the clinician submitted, and that is the only path that exists.
 */

export type AdminClinicRow = {
  id: string;
  name: string;
  clinicState: string | null;
  /** 🔴 74.6 — which of our companies bills them, which decides their rail. */
  region: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  clinicianCount: number;
  managers: { id: string; email: string; role: string }[];
};

export function ClinicManagerList({
  clinics,
  regions,
}: {
  clinics: AdminClinicRow[];
  /*
   * 🔴 74.6 — handed down rather than imported. `REGIONS` lives in a
   * `server-only` module, and importing it here is a webpack failure rather than
   * a runtime surprise: the boundary is doing its job. The page is a server
   * component and already has it.
   */
  regions: readonly string[];
}) {
  const t = useT();

  if (clinics.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-600">{t("aclinic.none")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {clinics.map((clinic) => (
        <ClinicRow key={clinic.id} clinic={clinic} regions={regions} />
      ))}
    </div>
  );
}

function ClinicRow({ clinic, regions }: { clinic: AdminClinicRow; regions: readonly string[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [regionState, setRegionState] = useState<{ error?: string; ok?: boolean }>({});
  const [managerState, managerAction] = useActionState(addManager, {});

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-slate-900">{clinic.name}</span>
        <span
          className={
            clinic.clinicState === "active"
              ? "rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800"
              : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
          }
        >
          {clinic.clinicState ? t(`admin.state.${clinic.clinicState}` as MessageKey) : null}
        </span>
        {/* 🔴 A COUNT, never a list. */}
        <span className="text-xs text-slate-500">
          {t("aclinic.clinicians", { count: clinic.clinicianCount })}
        </span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="tap-target ms-auto h-9 rounded-xl px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
          {open ? t("aclinic.close") : t("aclinic.open")}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-4 border-t border-slate-200 pt-3">
          <dl className="grid gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-700">{t("aclinic.contact")}</dt>
              <dd>{clinic.contactName ?? t("asponsor.notGiven")}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">{t("clinic.email")}</dt>
              <dd>{clinic.contactEmail ?? t("asponsor.notGiven")}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700">{t("clinic.phone")}</dt>
              <dd>{clinic.contactPhone ?? t("asponsor.notGiven")}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            {/* W2-A05: a confirm and a reason, and a refusal is shown rather than voided. */}
            {CLINIC_STATES.filter((state) => state !== clinic.clinicState).map((state) => (
              <ConfirmWithReason
                key={state}
                label={t(`admin.state.${state}` as MessageKey)}
                disabled={pending}
                onConfirm={(reason) => setState(clinic.id, state, reason)}
              />
            ))}
          </div>

          {/*
            🔴 74.6 — WHERE THEY BILL FROM, which decides the rail every
            clinician on this roster pays us on. Refused while an invoice is
            outstanding: moving it then changes which rail an issued bill is
            paid on, and which company's books it sits in.
          */}
          {/*
            🔴 B25 — THE CURRENT REGION FIRST, SAID AS THE CURRENT ONE. The
            row used to print only the region it could move TO, so an Egyptian
            practice read as "Billed from US".
          */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">{t("clinic.billedFrom")}</span>
            <span className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
              {t("admin.regionNow", { region: clinic.region.toUpperCase() })}
            </span>
            {regions.filter((region) => region !== clinic.region).map((region) => (
              <button
                key={region}
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => setRegionState(await setRegion(clinic.id, region)))
                }
                className="tap-target h-9 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                {t("admin.regionMove", { region: region.toUpperCase() })}
              </button>
            ))}
            {regionState.error ? (
              <p role="alert" className="w-full text-xs text-rose-600">{regionState.error}</p>
            ) : regionState.ok ? (
              <p role="status" className="w-full text-xs text-brand-700">
                {t("admin.regionMoved", { region: clinic.region.toUpperCase() })}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            {clinic.managers.map((manager) => (
              <p key={manager.id} className="text-xs text-slate-600">
                {manager.email} · {manager.role}
              </p>
            ))}

            <form action={managerAction} className="space-y-3 rounded-xl bg-slate-50 p-3">
              <input type="hidden" name="clinicOrganizationId" value={clinic.id} />
              <p className="text-xs font-semibold text-slate-700">{t("aclinic.addManager")}</p>
              <Field label={t("clinic.email")} htmlFor={`cm-email-${clinic.id}`}>
                <Input id={`cm-email-${clinic.id}`} name="email" type="email" required />
              </Field>
              <Field label={t("aclinic.name")} htmlFor={`cm-name-${clinic.id}`}>
                <Input id={`cm-name-${clinic.id}`} name="name" />
              </Field>
              <div className="flex gap-4 text-xs text-slate-700">
                <label className="flex items-center gap-2">
                  <input type="radio" name="role" value="viewer" defaultChecked /> viewer
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="role" value="admin" /> admin
                </label>
              </div>
              {managerState.error ? (
                <p role="alert" className="text-xs text-red-600">
                  {managerState.error}
                </p>
              ) : managerState.ok ? (
                /* B25: Create used to leave the form as it was, with nothing to say it worked. */
                <p role="status" className="text-xs text-brand-700">
                  {t("admin.invited")}
                </p>
              ) : null}
              <Submit label={t("aclinic.create")} />
            </form>
          </div>

          {/* 🔴 C267 — the thing this console does not offer either. */}
          <p className="text-xs leading-relaxed text-slate-500">{t("aclinic.cannotVerify")}</p>
        </div>
      ) : null}
    </Card>
  );
}
