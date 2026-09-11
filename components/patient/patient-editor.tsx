"use client";

import { useState, useTransition } from "react";

import { savePatient } from "@/app/(app)/patients/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { PhoneField } from "@/components/forms/phone-field";
import { countryFromE164, countryFromLocale } from "@/lib/phone/e164";

type Initial = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  diagnoses: string[];
  goals: string[];
};

export function PatientEditor({
  patientId,
  initial,
}: {
  patientId: string;
  initial: Initial;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(initial);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * 11R.12 — the country this number is read with.
   *
   * `toE164` ignores it when the field already starts with `+`, so a record
   * holding `+201001234567` survives a save that never touched the selector.
   * Measured before shipping this: 0 of the patient, people and
   * patient_accounts rows hold a phone number at all, so there is no legacy
   * national number for the default country to expand wrongly.
   */
  const [phoneCountry, setPhoneCountry] = useState(
    () =>
      /* 37R.25 — the number decides the label. A record holding +20 showed
         "United States" beside it because the selector only ever asked the
         browser. */
      countryFromE164(initial.phone) ??
      countryFromLocale(typeof navigator === "undefined" ? null : navigator.language) ??
      "EG",
  );

  const set = <K extends keyof Initial>(key: K, value: Initial[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () =>
    startTransition(async () => {
      setError(null);
      const result = await savePatient(patientId, { ...form, phoneCountry });
      if (result.error) setError(result.error);
      else setFeedback("Saved");
    });

  return (
    <Card className="space-y-4 p-4">
      {feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" htmlFor="firstName">
          <Input
            id="firstName"
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
          />
        </Field>
        <Field label="Last name" htmlFor="lastName">
          <Input
            id="lastName"
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Email" htmlFor="email" hint="Used only to send session summaries.">
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </Field>

      <Field label="Phone" htmlFor="phone">
        <PhoneField
          value={form.phone}
          country={phoneCountry}
          onValueChange={(v) => set("phone", v)}
          onCountryChange={setPhoneCountry}
        />
      </Field>

      <Field
        label="Working diagnoses"
        htmlFor="diagnoses"
        hint="Comma separated. Included as context when notes are written."
      >
        <Input
          id="diagnoses"
          value={form.diagnoses.join(", ")}
          onChange={(e) =>
            set(
              "diagnoses",
              e.target.value.split(",").map((s) => s.trim()),
            )
          }
        />
      </Field>

      <Field label="Treatment goals" htmlFor="goals" hint="Comma separated.">
        <Input
          id="goals"
          value={form.goals.join(", ")}
          onChange={(e) =>
            set(
              "goals",
              e.target.value.split(",").map((s) => s.trim()),
            )
          }
        />
      </Field>

      <div className="flex gap-2.5 pt-1">
        <Button full onClick={handleSave} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>

      {/*
        No delete button, on purpose.
        -----------------------------
        A therapy record is a legal document with a retention period measured in
        years. A clinician who deletes a chart after a complaint has destroyed
        evidence whether or not they meant to, so the capability does not exist
        — not in this component, not in the server action, not in the data
        layer. Corrections are made by editing above; a patient asking for their
        data or its erasure goes through us, where the retention question can
        actually be answered.
      */}
      <div className="space-y-3 border-t border-slate-100 pt-3">
        <p className="text-xs leading-relaxed text-slate-400">
          Records cannot be deleted, and cannot be emailed out of here. Sessions and notes are
          kept for the retention period your regulator requires. If this patient asks for their
          data or asks you to erase it, send them to us, we handle both, and you will be told
          when we do.
        </p>
      </div>
    </Card>
  );
}
