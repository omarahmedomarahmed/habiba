"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Link2, User, Users, Video } from "lucide-react";

import { startNewSession, type SessionActionState } from "@/app/(app)/sessions/actions";
import { Button, Field, Input } from "@/components/clinician/kit";
import { SeesWhat, SplitBar } from "@/components/visual/primitives";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { Money } from "@/components/ui/money";
import { useMoneyDisplay } from "@/components/money/display";
import { egpMinorFor, usdCentsFor } from "@/lib/money/convert";
import { rich, slot } from "@/lib/i18n/rich";

type PatientOption = { id: string; name: string; email: string | null };

const INITIAL: SessionActionState = {};

function Submit() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="lg" variant="primary" full disabled={pending}>
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
type WhereOption = "in_person" | "24t_room" | "zoom" | "google_meet" | "teams";

export function NewSessionForm({
  patients,
  connectedProviders = [],
  payments,
  ourFees,
}: {
  patients: PatientOption[];
  /**
   * 🔴 K22: our own per-session fees, read from settings and the clinician's
   * tier by the page. The notice hard-coded $1 and $3, so an operator's change
   * to either fee left this sentence quoting the old ones. Null when their
   * plan covers both.
   */
  ourFees: { platformCents: number; aiCents: number } | null;
  /**
   * 41.2 — the providers this clinician has actually connected.
   *
   * 🔴 Only connected ones are offered. A Zoom option for somebody with no
   * Zoom connection creates a session that quietly falls back to the
   * 24Therapy room, and they find out when their patient is already in the
   * wrong place.
   */
  connectedProviders?: { provider: "zoom" | "google_meet" | "teams"; name: string }[];
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
    /**
     * 🔴 76.3 — the tax the PATIENT will be asked for on top, when it is knowable.
     *
     * Zero on the card rail and that is honest there: nobody knows the patient's
     * country until they open the pay page and pick one. Non-zero on the
     * transfer rail, where the rail exists because the practice is Egyptian, so
     * the country is settled before the price is typed.
     */
    vatBps: number;
    /** True when we will hold their share rather than pay it out. */
    held: boolean;
  };
}) {
  const [state, action] = useActionState(startNewSession, INITIAL);
  const t = useT();
  /*
   * 41.2 — one question. `modality` is derived, never asked, so the two cannot
   * disagree.
   */
  const [where, setWhere] = useState<WhereOption>("in_person");
  const [transcribe, setTranscribe] = useState(true);
  const modality = where === "in_person" ? "in_person" : "video";
  const [existing, setExisting] = useState<string>("");
  const [charge, setCharge] = useState(false);
  /* 🔴 Rulings 5 and 5b: in person, paid to the therapist directly, or through us before the start. */
  const [inPersonPayment, setInPersonPayment] = useState<"direct" | "through_us">("direct");
  /* 🔴 Pounds in the box, dollars in the books, at the operator's rate that came with the page. */
  const { rateMicro } = useMoneyDisplay();
  const [price, setPrice] = useState(
    payments?.defaultRateCents && rateMicro > 0
      ? String(Math.round(egpMinorFor(payments.defaultRateCents, rateMicro) / 100))
      : "",
  );

  const priceCents = rateMicro > 0 ? usdCentsFor(Math.round((Number(price) || 0) * 100), rateMicro) : 0;
  const cut = payments ? Math.floor((priceCents * payments.feeBps) / 10_000) : 0;
  /*
   * 🔴 76.3 — plain arithmetic, deliberately, and NOT `Intl` (C84). The rate
   * arrived from the server; rounding it here is the same half-up rounding
   * `vatOn` does, and `formatUsd` is the repository's own formatter rather than
   * the runtime's locale.
   */
  const vatCents =
    payments && payments.vatBps > 0
      ? Math.round((priceCents * payments.vatBps) / 10_000)
      : 0;
  const chargeable =
    Boolean(payments) &&
    ((modality === "video" && charge) || (modality === "in_person" && inPersonPayment === "through_us"));

  return (
    <form action={action} className="space-y-6">
      {state.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <input type="hidden" name="modality" value={modality} />
      <input type="hidden" name="where" value={where} />
      <input type="hidden" name="transcribe" value={transcribe ? "on" : "off"} />

      {/*
        🔴 41.2 — "Where", which replaces the old two-way modality toggle.

        The clinician answers one question rather than two. `modality` is
        derived from it on both sides of the wire, because a person asked both
        would eventually answer them inconsistently and every downstream rule
        reads `modality`.

        Only CONNECTED providers appear. A Zoom option for somebody with no
        Zoom connection is a button that creates a session and then quietly
        falls back to the 24Therapy room, which is worse than not offering it:
        they would find out when their patient was already in the wrong place.
      */}
      <div>
        <p className="mb-2 text-sm font-medium text-navy-600">{t("portal.new.where")}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <ModalityOption
            active={where === "in_person"}
            onClick={() => setWhere("in_person")}
            icon={<User className="h-5 w-5" aria-hidden />}
            title={t("portal.new.whereInPerson")}
            body={t("tnew.inPersonBody")}
          />
          <ModalityOption
            active={where === "24t_room"}
            onClick={() => setWhere("24t_room")}
            icon={<Video className="h-5 w-5" aria-hidden />}
            title={t("portal.new.whereRoom")}
            body={t("tnew.videoBody")}
          />
          {connectedProviders.map((provider) => (
            <ModalityOption
              key={provider.provider}
              active={where === provider.provider}
              onClick={() => setWhere(provider.provider)}
              icon={<Video className="h-5 w-5" aria-hidden />}
              title={provider.name}
              body={t("portal.new.patientLinkDiffers")}
            />
          ))}
        </div>

        {connectedProviders.length === 0 ? (
          <p className="mt-2 text-xs leading-relaxed text-navy-400">
            {t("portal.new.connectFirst")}
          </p>
        ) : null}
      </div>

      {/*
        🔴 41.2 — the Record tick, and what it is NOT.

        It does not decide whether the session is recorded. The patient decides
        that, on their own screen, and 41.8 dispatches the recorder on their
        answer and nothing else. What this decides is whether they are asked at
        all: a clinician who knows this session should not be transcribed
        should not have their patient answer a question that will be ignored.
      */}
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={transcribe}
          onChange={(event) => setTranscribe(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-navy-200"
        />
        <span className="min-w-0 text-sm font-medium text-navy-700">
          {t("portal.new.record")}
        </span>
      </label>

      {/*
        🔴 65.10 — THE CONSENT RULES, AS THE SHAPE THE PATIENT'S OWN SCREEN USES.

        > *The verification requirements, the fee explanation, the payout rails and the
        > consent rules become components.*

        A clinician ticking this box is deciding something about somebody who is not in
        the room yet, and the sentence under the checkbox said only the first half of it:
        the patient is asked first. What it did not say is the half a clinician worries
        about — that saying no does not cost them the session, and that the note will
        record when capture actually began rather than implying it covered the hour.

        The patient meets this same rule on `/patient/consent` as two columns. It is the
        same two columns here, which is 65.4's rule: the same rule on two screens has to
        look like the same rule, even when the two readers are on opposite sides of it.
      */}
      {transcribe ? (
        <div className="mt-3">
          <SeesWhat
            /* In person there is no second screen: they answer on yours (task 123). */
            who={t(modality === "in_person" ? "portal.new.consentWhoInPerson" : "portal.new.consentWho")}
            can={[t("portal.new.consentAsked"), t("portal.new.consentStop")]}
            cannot={[t("portal.new.consentCost"), t("portal.new.consentPretend")]}
          />
        </div>
      ) : null}

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
            className="h-12 w-full rounded-xl border border-navy-100 bg-white px-3 text-navy-700 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 focus:outline-none"
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
      <input type="hidden" name="pricePounds" value={chargeable ? price || "0" : "0"} />
      <input type="hidden" name="inPersonPayment" value={modality === "in_person" ? inPersonPayment : ""} />

      {modality === "in_person" ? (
        <div className="space-y-3 rounded-2xl border border-navy-100 p-4">
          <p className="text-sm font-medium text-navy-700">{t("tnew.howPaid")}</p>
          {(["direct", "through_us"] as const).map((option) => (
            <label key={option} className="flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="inPersonPaymentChoice"
                checked={inPersonPayment === option}
                onChange={() => setInPersonPayment(option)}
                disabled={option === "through_us" && !payments}
                className="mt-0.5 h-4 w-4 border-navy-200 text-brand-700 focus:ring-brand-600"
              />
              <span className="min-w-0 text-sm text-navy-700">
                {t(option === "direct" ? "tnew.paidDirect" : "tnew.paidThroughUs")}
              </span>
            </label>
          ))}
          {inPersonPayment === "through_us" && payments ? (
            <Field label={t("tnew.price")} htmlFor="price-in-person">
              <Input
                id="price-in-person"
                type="number"
                inputMode="decimal"
                step={1}
                min={1}
                max={rateMicro > 0 && payments.defaultRateCents ? Math.floor(egpMinorFor(payments.defaultRateCents, rateMicro) / 100) : undefined}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />
            </Field>
          ) : null}
          {/* 🔴 Ruling 5: the pay-as-you-go notice, before the session starts, either way. */}
          <p className="text-xs text-navy-400">
            {ourFees
              ? rich(t("tnew.paygNotice", { platform: slot(0), ai: slot(1) }), [
                  <Money key="platform" cents={ourFees.platformCents} />,
                  <Money key="ai" cents={ourFees.aiCents} />,
                ])
              : t("tnew.planCoversFees")}
          </p>
        </div>
      ) : null}

      {modality === "video" && payments ? (
        <div className="rounded-2xl border border-navy-100 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={charge}
              onChange={(event) => setCharge(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-navy-200 text-brand-700 focus:ring-brand-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-navy-700">
                {t("tnew.charge")}
              </span>
              <span className="mt-0.5 block text-xs text-navy-400">
                {t("tnew.chargeBody")}
              </span>
            </span>
          </label>

          {charge ? (
            <div className="mt-3 space-y-3">
              <Field label={t("tnew.price")} htmlFor="price">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-xs text-navy-400">
                    EGP
                  </span>
                  <Input
                    id="price"
                    type="number"
                    inputMode="decimal"
                    min={rateMicro > 0 ? Math.ceil(egpMinorFor(payments.minPriceCents, rateMicro) / 100) : undefined}
                    max={rateMicro > 0 ? Math.floor(egpMinorFor(payments.maxPriceCents, rateMicro) / 100) : undefined}
                    step={1}
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    className="ps-12"
                    placeholder="1000"
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
                /*
                 * 🔴 65.10 — THE SPLIT IS THE BAR NOW, and the numbers are its legend.
                 *
                 * The sentence it replaced was arithmetically complete and told a
                 * clinician nothing at a glance: "You keep $51, 24Therapy takes $9
                 * (15%)" makes the reader do the division to find out whether that is a
                 * lot. The bar has done it before they reach the second figure.
                 *
                 * VAT is still absent and still for the reason above: it is a fact about
                 * the PATIENT's country, which nobody knows until they open the pay page
                 * and choose one. `SplitBar` takes two parts here and is honest about
                 * being a split of what the clinician charges.
                 */
                <SplitBar
                  parts={[
                    {
                      label: rich(t("tnew.youKeep", { amount: slot(0) }), [<Money cents={priceCents - cut} />]),
                      value: priceCents - cut,
                      kind: "keep",
                    },
                    {
                      label: rich(t("tnew.ourFee", {
                        amount: slot(0),
                        percent: payments.feeBps / 100,
                      }), [<Money cents={cut} />]),
                      value: cut,
                      kind: "fee",
                    },
                  ]}
                  /*
                   * 🔴 76.3 — THE PATIENT'S TOTAL, NAMED, WHERE IT IS KNOWABLE.
                   *
                   * On the card rail this stays the old sentence, and that is
                   * the truthful one there: the patient's country is not known
                   * until they open the pay page. On the transfer rail the
                   * country is the reason the rail is showing at all, so the
                   * clinician can be told the real figure while they are still
                   * choosing the price rather than after a patient queries it.
                   *
                   * All three numbers, because the clinician's question is not
                   * "what is the tax" but "what will my patient see, and why is
                   * it bigger than the number I typed".
                   */
                  note={
                    vatCents > 0
                      ? rich(t("tnew.patientPays", {
                          total: slot(0),
                          vat: slot(1),
                        }), [<Money cents={priceCents + vatCents} />, <Money cents={vatCents} />])
                      : t("tnew.vatOnTop")
                  }
                />
              ) : null}

              {/*
                🔴 76.3 — AND THAT THEIR SHARE IS HELD, which is what the radar
                already discloses in the same situation and in the same words.
                An Egyptian clinician has no Stripe account and never will until
                a gateway exists, so this is the ordinary state here rather than
                a warning about something going wrong.
              */}
              {priceCents > 0 && payments.held ? (
                <p className="mt-2 text-xs leading-relaxed text-navy-400">{t("tnew.weHold")}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {modality === "video" ? (
        <p className="flex items-start gap-2 rounded-xl bg-navy-50 px-3.5 py-3 text-xs leading-relaxed text-navy-400">
          <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("tnew.linkNote")}
        </p>
      ) : null}

      <Submit />

      <p className="flex items-start gap-2 text-xs leading-relaxed text-navy-400">
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
          ? "border-brand-600 bg-brand-50 text-brand-900"
          : "border-navy-100 bg-white text-navy-600 hover:border-navy-200",
      )}
    >
      <span className={cn(active ? "text-brand-700" : "text-navy-400")}>{icon}</span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs text-navy-400">{body}</span>
    </button>
  );
}
