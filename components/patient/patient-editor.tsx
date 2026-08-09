"use client";

import { useState, useTransition } from "react";

import { Send } from "lucide-react";

import { emailPatientTheirRecord, savePatient } from "@/app/(app)/patients/actions";
import { Button, Card, Field, Input } from "@/components/ui";

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

  const set = <K extends keyof Initial>(key: K, value: Initial[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () =>
    startTransition(async () => {
      setError(null);
      const result = await savePatient(patientId, form);
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
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
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
        <RecordExport patientId={patientId} hasEmail={Boolean(form.email.trim())} />
        <p className="text-xs leading-relaxed text-slate-400">
          Records cannot be deleted. Sessions and notes are kept for the retention period your
          regulator requires. If a patient asks you to erase their record, contact support — that
          is a retention-law question, not a button.
        </p>
      </div>
    </Card>
  );
}

/**
 * "Send them their record."
 *
 * This is what replaced admin impersonation. A patient asks for their data, the
 * clinician presses this, and a link lands in the patient's inbox. Nobody at
 * 24Therapy — and nobody in the practice who was not already allowed to — reads
 * a word of it in the process.
 */
function RecordExport({ patientId, hasEmail }: { patientId: string; hasEmail: boolean }) {
  const [pending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (sentTo) {
    return (
      <p className="rounded-xl bg-teal-50 px-3.5 py-2.5 text-sm text-teal-800">
        Sent to {sentTo}. The link works for 72 hours and then stops.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <Button
        variant="secondary"
        full
        disabled={pending || !hasEmail}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await emailPatientTheirRecord(patientId);
            if (result.error) setError(result.error);
            else setSentTo(result.sentTo ?? null);
          })
        }
      >
        <Send className="h-4 w-4" aria-hidden />
        {pending ? "Sending…" : "Email them their full record"}
      </Button>
      <p className="text-xs leading-relaxed text-slate-400">
        {hasEmail
          ? "Everything on file — sessions, notes, transcripts — as one page they can save or print. It goes to their address, not yours."
          : "Add an email address above first. The record only ever goes to the patient."}
      </p>
    </div>
  );
}
