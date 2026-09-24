"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { askLicenceChange, type OnboardingState } from "@/app/(app)/onboarding/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

const INITIAL: OnboardingState = {};

/** The fields, labelled with the words the two forms already use for them. */
const FIELDS = [
  ["licenseBody", "tver.regulator"],
  ["licenseNumber", "tver.licenceNumber"],
  ["licenseExpiry", "tver.licenceExpiry"],
  ["credentials", "tset.credentials"],
  ["licenseType", "tset.licenceType"],
  ["licenseState", "tset.licenceState"],
] as const satisfies readonly (readonly [string, MessageKey])[];

type Values = Record<(typeof FIELDS)[number][0], string>;

/**
 * 🔴 W1-23: an approved clinician changes their licence details.
 *
 * What they send is held for an operator; what patients read, and what
 * "Licence checked" refers to, stays the details that were checked until the
 * operator approves. They stay cleared meanwhile.
 */
export function LicenceChangeForm({
  initial,
  pending,
  reviewNote,
}: {
  initial: Values;
  /** A change is already with us. */
  pending: boolean;
  /** Why the last change was not accepted, when it was not. */
  reviewNote: string | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(askLicenceChange, INITIAL);
  const waiting = pending || state.ok === true;

  return (
    <Card className="space-y-3 p-4">
      {waiting ? (
        <p role="status" className="text-sm text-slate-700">
          {t("tlic.changePending")}
        </p>
      ) : reviewNote ? (
        <p className="text-sm text-slate-700">{reviewNote}</p>
      ) : null}

      {open && !waiting ? (
        <form action={action} className="space-y-3">
          {state.error ? (
            <p role="alert" className="text-sm text-red-700">
              {state.error}
            </p>
          ) : null}
          {FIELDS.map(([name, label]) => (
            <Field key={name} label={t(label)} htmlFor={`change-${name}`}>
              <Input id={`change-${name}`} name={name} defaultValue={initial[name]} />
            </Field>
          ))}
          <Send label={t("tlic.change")} />
        </form>
      ) : !waiting ? (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {t("tlic.change")}
        </Button>
      ) : null}
    </Card>
  );
}

function Send({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("common.saving") : label}
    </Button>
  );
}
