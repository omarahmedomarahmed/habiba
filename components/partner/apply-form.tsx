"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { apply } from "@/app/(partner)/partner/apply/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
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
 * 55.2 — the integrator enquiry. A company, a contact, and what they want to build.
 *
 * 🔴 THE "WHAT DO YOU WANT TO BUILD" FIELD IS REQUIRED, AND IT IS NOT A FORMALITY.
 *
 * Keys are scoped to one use case at a time and issued on a call. An operator reading this
 * field is how a key gets the right scope and only that scope; without it the call starts
 * from "what do you need", the honest answer is "everything, to be safe", and a key that
 * can do everything is the key nobody can safely revoke half of.
 *
 * 🔴 It does NOT ask how many clinicians or how many employees. That question invites a
 * number, the number invites a bulk provisioning path, and a roster arriving before anybody
 * on it consented is precisely what C255 exists to refuse.
 */
export function PartnerApplyForm() {
  const t = useT();
  const [state, formAction] = useActionState(apply, {});

  if (state.sent) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">{t("dev.apply.sent")}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("dev.apply.sentBody")}</p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <form action={formAction} className="space-y-4">
        <Field label={t("dev.apply.company")} htmlFor="partner-apply-name">
          <Input id="partner-apply-name" name="name" required />
        </Field>

        <Field label={t("dev.apply.contact")} htmlFor="partner-apply-contact">
          <Input id="partner-apply-contact" name="contactName" required />
        </Field>

        <Field label={t("dev.email")} htmlFor="partner-apply-email">
          <Input
            id="partner-apply-email"
            name="contactEmail"
            type="email"
            autoCapitalize="none"
            required
          />
        </Field>

        <Field label={t("dev.apply.phone")} htmlFor="partner-apply-phone">
          <Input id="partner-apply-phone" name="contactPhone" type="tel" required />
        </Field>

        <Field label={t("dev.apply.intent")} htmlFor="partner-apply-intent">
          <Textarea id="partner-apply-intent" name="intent" rows={4} required />
        </Field>

        {state.error ? (
          <p role="alert" className="text-xs text-red-600">
            {state.error}
          </p>
        ) : null}

        <Submit label={t("dev.apply.submit")} />
      </form>
    </Card>
  );
}
