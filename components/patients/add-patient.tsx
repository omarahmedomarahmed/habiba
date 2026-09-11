"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";

import { addPatient } from "@/app/(app)/patients/actions";
import { PhoneField } from "@/components/forms/phone-field";
import { Button, Card, Field, Input } from "@/components/ui";
import { countryFromLocale } from "@/lib/phone/e164";

/**
 * Writing down a new patient. PLAN.md 12.4, §3b.
 *
 * ## Why this form exists now
 *
 * `addPatient` has been a server action with no screen since sprint 1 —
 * patient rows were only ever created as a side effect of a session or a
 * booking. That was survivable while a record was just a chart. It is not
 * survivable under §3b, where the therapist is the one who invites a person to
 * claim their own record, and cannot do that for somebody they were never able
 * to write down.
 *
 * ## The number is mandatory and the form says why
 *
 * 🔴 Not a red asterisk. A therapist who does not know *why* a phone number is
 * suddenly required will type one in to get past the form, and a number typed
 * to get past a form is a number that reaches a stranger. The sentence is the
 * feature.
 */
function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Add patient"}
    </Button>
  );
}

export function AddPatient() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(addPatient, {});

  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState(
    () => countryFromLocale(typeof navigator === "undefined" ? null : navigator.language) ?? "EG",
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-target flex w-full items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3.5 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50"
      >
        <UserPlus className="h-4 w-4 text-slate-400" aria-hidden />
        Add a patient
      </button>
    );
  }

  return (
    <Card className="p-4">
      <form action={formAction} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor="firstName">
            <Input id="firstName" name="firstName" autoComplete="off" required />
          </Field>
          <Field label="Last name (optional)" htmlFor="lastName">
            <Input id="lastName" name="lastName" autoComplete="off" />
          </Field>
        </div>

        <Field label="Phone" htmlFor="phone">
          <PhoneField
            value={phone}
            country={phoneCountry}
            onValueChange={setPhone}
            onCountryChange={setPhoneCountry}
            name="phone"
            countryName="phoneCountry"
          />
          {/*
            §3b's own words. The reason is on the form, before they type — not
            in an error after they have already skipped it.
          */}
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Required, so you can invite them to join by WhatsApp and hand them their own record.
          </p>
        </Field>

        <Field label="Email (optional)" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="off" />
          <p className="mt-1 text-xs text-slate-500">
            A complete alternative to WhatsApp for everything, the invite, the code, the summary.
          </p>
        </Field>

        {state.error ? (
          <p role="alert" aria-live="assertive" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}

        {/*
          🔴 C186 — the way past a duplicate number, and it only appears once
          somebody has been told what they are doing.

          Two people really can share a phone: a parent's number on a child's
          record is ordinary. What is not ordinary is two charts for one person,
          which is what happened here before the check existed, so the second
          record costs one deliberate tick and a link to the one that is
          already open.
        */}
        {state.duplicateOf ? (
          <div className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
            <Link
              href={`/patients/${state.duplicateOf}`}
              className="font-semibold underline underline-offset-2"
            >
              Open the record that already has this number
            </Link>
            <label className="mt-2 flex items-start gap-2 text-xs leading-relaxed">
              <input type="checkbox" name="duplicate" value="allow" className="mt-0.5" />
              <span>
                This is a different person who shares that phone. Add them as a second record.
              </span>
            </label>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Submit />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="tap-target h-11 rounded-xl px-3 text-sm font-medium text-slate-600"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
