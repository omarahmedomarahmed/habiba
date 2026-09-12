"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { DollarSign, Link2, User, Users, Video } from "lucide-react";

import { startNewSession, type SessionActionState } from "@/app/(app)/sessions/actions";
import { Button, Field, Input } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

type PatientOption = { id: string; name: string; email: string | null };

const INITIAL: SessionActionState = {};

function Submit() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="lg" variant="teal" full disabled={pending}>
      {pending ? t("tnew.starting") : t("tnew.startNow")}
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
  /**
   * The live figures, handed down rather than imported.
   *
   * `feeBps`, `minPriceCents` and `maxPriceCents` all come from
   * `platform_settings` now. The form must render from the same snapshot the
   * server will validate against, or a therapist gets told $5 is fine and then
   * that it is not.
   */
  payments?: {
    defaultRateCents: number;
    feeBps: number;
    minPriceCents: number;
    maxPriceCents: number;
  };
}) {
  const [state, action] = useActionState(startNewSession, INITIAL);
  const t = useT();
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
          <p className="text-sm font-semibold text-teal-900">{t("tnew.welcome")}</p>
          <p className="mt-0.5 text-sm text-teal-800">
            {t("tnew.welcomeBody")}
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
        <p className="mb-2 text-sm font-medium text-slate-700">{t("tnew.type")}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <ModalityOption
            active={modality === "in_person"}
            onClick={() => setModality("in_person")}
            icon={<User className="h-5 w-5" aria-hidden />}
            title={t("tnew.inPerson")}
            body={t("tnew.inPersonBody")}
          />
          <ModalityOption
            active={modality === "video"}
            onClick={() => setModality("video")}
            icon={<Video className="h-5 w-5" aria-hidden />}
            title={t("tnew.video")}
            body={t("tnew.videoBody")}
          />
        </div>
      </div>

      {patients.length > 0 ? (
        <Field
          label={t("tnew.existing")}
          htmlFor="patientId"
          hint={t("tnew.existingHint")}
        >
          <select
            id="patientId"
            name="patientId"
            value={existing}
            onChange={(event) => setExisting(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none"
          >
            <option value="">{t("tnew.newPatient")}</option>
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
          <Field label={t("tnew.firstName")} htmlFor="guestName">
            <Input
              id="guestName"
              name="guestName"
              placeholder={t("tnew.firstNamePlaceholder")}
              autoComplete="off"
              autoCapitalize="words"
              required={!existing}
            />
          </Field>

          {/*
            🔴 25.18 — the mobile number, asked at the same moment as the name.

            §3b makes the number the identity, and this is the one screen where
            a clinician is looking at the person. Asking for it here is what
            lets the invite that hands them their own record go out with the
            session rather than from a page nobody visits twice.
          */}
          <Field
            label={t("tnew.mobile")}
            htmlFor="guestPhone"
            hint={t("tnew.mobileHint")}
          >
            <Input
              id="guestPhone"
              name="guestPhone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="+20 100 123 4567"
            />
          </Field>

          <Field
            label={modality === "video" ? t("tnew.email") : t("tnew.emailOptional")}
            htmlFor="guestEmail"
            hint={
              modality === "video" ? t("tnew.emailHintVideo") : t("tnew.emailHintInPerson")
            }
          >
            <Input
              id="guestEmail"
              name="guestEmail"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              placeholder={t("tnew.emailPlaceholder")}
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
                {t("tnew.charge")}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {t("tnew.chargeBody")}
              </span>
            </span>
          </label>

          {charge ? (
            <div className="mt-3 space-y-3">
              <Field label={t("tnew.price")} htmlFor="price">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-slate-400">
                    $
                  </span>
                  <Input
                    id="price"
                    type="number"
                    inputMode="decimal"
                    min={payments.minPriceCents / 100}
                    max={payments.maxPriceCents / 100}
                    step={1}
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    className="ps-7"
                    placeholder="60"
                    required
                  />
                </div>
              </Field>

              {priceCents > 0 ? (
                /*
                 * Separate lines with reasons, never one number (§3).
                 *
                 * VAT is not shown here because it is a fact about the
                 * *patient's* country, which is not known until they open the
                 * pay page and choose one — sprint 4. What the therapist can be
                 * told truthfully today is their own side of the split, so that
                 * is all this says.
                 */
                <p className="flex items-center gap-1.5 text-xs text-slate-600">
                  <DollarSign className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
                  {t("tnew.split", {
                    keep: formatUsd(priceCents - cut),
                    fee: formatUsd(cut),
                    percent: payments.feeBps / 100,
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {modality === "video" ? (
        <p className="flex items-start gap-2 rounded-xl bg-slate-100 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
          <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("tnew.linkNote")}
        </p>
      ) : null}

      <Submit />

      <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {t("tnew.consent")}
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
        "flex flex-col items-start gap-1.5 rounded-2xl border p-4 text-start transition-colors",
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
