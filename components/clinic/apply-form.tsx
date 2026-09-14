"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { apply } from "@/app/(clinic)/clinic/apply/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button full size="lg" type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

/**
 * 54.3 — the practice enquiry. A name, a contact, an email and a phone number.
 *
 * 🔴 It does NOT ask how many clinicians. That question invites a number, the number
 * invites a bulk import, and a bulk import is a staff list arriving before anybody on
 * it consented (C267 means each of them must act personally anyway). The clinic adds
 * clinicians one at a time, afterwards, from inside.
 */
export function ClinicApplyForm() {
  const t = useT();
  const [state, formAction] = useActionState(apply, {});

  if (state.sent) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">{t("clinic.apply.sent")}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {t("clinic.apply.sentBody")}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <Field label={t("clinic.apply.name")} htmlFor="clinic-apply-name">
          <Input id="clinic-apply-name" name="name" required />
        </Field>

        <Field label={t("clinic.apply.contact")} htmlFor="clinic-apply-contact">
          <Input id="clinic-apply-contact" name="contactName" required />
        </Field>

        <Field label={t("clinic.email")} htmlFor="clinic-apply-email">
          <Input
            id="clinic-apply-email"
            name="contactEmail"
            type="email"
            autoCapitalize="none"
            required
          />
        </Field>

        <Field label={t("clinic.apply.phone")} htmlFor="clinic-apply-phone">
          <Input id="clinic-apply-phone" name="contactPhone" type="tel" required />
        </Field>

        {/*
          🔴 63.18 — the licence and the names, asked HERE rather than on the call.

          54.3's ruling is unchanged: this creates a HELD row and a phone call, never
          an active clinic. These fields do not shorten that path, they shorten the
          call, and the operator arrives at it already knowing the size of the
          onboarding.
        */}
        <Field label={t("clinic.apply.registration")} htmlFor="clinic-apply-reg">
          <Input id="clinic-apply-reg" name="registrationNumber" />
        </Field>
        <Field label={t("clinic.apply.authority")} htmlFor="clinic-apply-authority">
          <Input id="clinic-apply-authority" name="registrationAuthority" />
        </Field>

        <Field label={t("clinic.apply.clinicians")} htmlFor="clinic-apply-clinicians">
          <textarea
            id="clinic-apply-clinicians"
            name="intendedClinicians"
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </Field>

        {/*
          🔴 C267 — WHY WE ASK FOR NAMES AND NOT FOR LICENCES, on the form.

          A practice typing a staff list expects to be asked for their credentials
          next, and finding out later that each person has to verify personally is
          the kind of surprise that arrives three weeks into an onboarding. The
          sentence is here instead.
        */}
        <p className="text-xs leading-relaxed text-slate-500">
          {t("clinic.apply.cliniciansWhy")}
        </p>

        {state.error ? (
          <p role="alert" className="text-xs text-red-600">
            {state.error}
          </p>
        ) : null}

        <Submit label={t("clinic.apply.submit")} />
      </form>
    </Card>
  );
}
