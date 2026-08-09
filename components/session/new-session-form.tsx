"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { DollarSign, Link2, User, Users, Video } from "lucide-react";

import { startNewSession, type SessionActionState } from "@/app/(app)/sessions/actions";
import { Button, Field, Input } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

type PatientOption = { id: string; name: string; email: string | null };

const INITIAL: SessionActionState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="teal" full disabled={pending}>
      {pending ? "Starting…" : "Start session now"}
    </Button>
  );
}

/**
 * The whole "create a session" flow.
 *
 * One screen, one required field. In person is preselected because it is the
 * common case and because it needs nothing else — no scheduling, no invitation,
 * no waiting room. The equivalent flow before this involved a nine-step
 * onboarding wizard, an admin approval, and a separate patient record.
 */
export function NewSessionForm({
  patients,
  welcome,
  payments,
}: {
  patients: PatientOption[];
  welcome?: boolean;
  /** Absent when the therapist has not finished Stripe onboarding. */
  payments?: { defaultRateCents: number; feeBps: number };
}) {
  const [state, action] = useActionState(startNewSession, INITIAL);
  const [modality, setModality] = useState<"in_person" | "video">("in_person");
  const [existing, setExisting] = useState<string>("");
  const [charge, setCharge] = useState(false);
  const [price, setPrice] = useState(
    payments?.defaultRateCents ? String(payments.defaultRateCents / 100) : "",
  );

  const priceCents = Math.round((Number(price) || 0) * 100);
  const cut = payments ? Math.floor((priceCents * payments.feeBps) / 10_000) : 0;
  const chargeable = modality === "video" && charge && Boolean(payments);

  return (
    <form action={action} className="space-y-6">
      {welcome ? (
        <div className="rounded-2xl bg-teal-50 px-4 py-3.5">
          <p className="text-sm font-semibold text-teal-900">You are in.</p>
          <p className="mt-0.5 text-sm text-teal-800">
            Start a session below — the first one is on us. Everything else can wait.
          </p>
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <input type="hidden" name="modality" value={modality} />

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Session type</p>
        <div className="grid grid-cols-2 gap-2.5">
          <ModalityOption
            active={modality === "in_person"}
            onClick={() => setModality("in_person")}
            icon={<User className="h-5 w-5" aria-hidden />}
            title="In person"
            body="Record from this device"
          />
          <ModalityOption
            active={modality === "video"}
            onClick={() => setModality("video")}
            icon={<Video className="h-5 w-5" aria-hidden />}
            title="Video"
            body="Send a join link"
          />
        </div>
      </div>

      {patients.length > 0 ? (
        <Field label="Existing patient" htmlFor="patientId" hint="Or leave blank and type a name.">
          <select
            id="patientId"
            name="patientId"
            value={existing}
            onChange={(event) => setExisting(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none"
          >
            <option value="">New patient</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {!existing ? (
        <>
          <Field label="Patient first name" htmlFor="guestName">
            <Input
              id="guestName"
              name="guestName"
              placeholder="Alex"
              autoComplete="off"
              autoCapitalize="words"
              required={!existing}
            />
          </Field>

          <Field
            label={modality === "video" ? "Patient email" : "Patient email (optional)"}
            htmlFor="guestEmail"
            hint={
              modality === "video"
                ? "We will email them the join link. You can also copy it in the room."
                : "Only used if you choose to send them a summary afterwards."
            }
          >
            <Input
              id="guestEmail"
              name="guestEmail"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              placeholder="alex@example.com"
            />
          </Field>
        </>
      ) : null}

      {/*
        Zero unless the therapist deliberately turns charging on. A session that
        silently costs the patient money because a rate was saved in settings
        weeks ago is the kind of default that loses a licence, not a customer.
      */}
      <input type="hidden" name="priceDollars" value={chargeable ? price || "0" : "0"} />

      {modality === "video" && payments ? (
        <div className="rounded-2xl border border-slate-200 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={charge}
              onChange={(event) => setCharge(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800">
                Ask the patient to pay before joining
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                The link becomes a payment link. They cannot enter the room until it clears.
              </span>
            </span>
          </label>

          {charge ? (
            <div className="mt-3 space-y-3">
              <Field label="Price for this session" htmlFor="price">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                    $
                  </span>
                  <Input
                    id="price"
                    type="number"
                    inputMode="decimal"
                    min={5}
                    step={1}
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    className="pl-7"
                    placeholder="60"
                    required
                  />
                </div>
              </Field>

              {priceCents > 0 ? (
                <p className="flex items-center gap-1.5 text-xs text-slate-600">
                  <DollarSign className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
                  You keep {formatUsd(priceCents - cut)} — 24Therapy takes {formatUsd(cut)}.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {modality === "video" ? (
        <p className="flex items-start gap-2 rounded-xl bg-slate-100 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
          <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Your patient joins from a private link — no account, no download. The link expires in 12
          hours and stops working the moment the session ends.
        </p>
      ) : null}

      <Submit />

      <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Confirm your patient has consented to being recorded before you start.
      </p>
    </form>
  );
}

function ModalityOption({
  active,
  onClick,
  icon,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-2xl border p-4 text-left transition-colors",
        active
          ? "border-brand-500 bg-brand-50 text-brand-900"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
      )}
    >
      <span className={cn(active ? "text-brand-600" : "text-slate-400")}>{icon}</span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs text-slate-500">{body}</span>
    </button>
  );
}
