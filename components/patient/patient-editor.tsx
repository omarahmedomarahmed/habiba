"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { removePatient, savePatient } from "@/app/(app)/patients/actions";
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
  const [confirmDelete, setConfirmDelete] = useState(false);

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

      <div className="border-t border-slate-100 pt-3">
        {confirmDelete ? (
          <div className="space-y-2.5">
            <p className="text-sm text-slate-600">
              Delete this patient? Their sessions and notes stay in the record and remain
              accessible for audit, but the chart is removed from your caseload.
            </p>
            <div className="flex gap-2.5">
              <Button variant="secondary" full onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                full
                disabled={pending}
                onClick={() => startTransition(() => removePatient(patientId))}
              >
                Delete patient
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="tap-target flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete patient
          </button>
        )}
      </div>
    </Card>
  );
}
