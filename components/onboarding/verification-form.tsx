"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, ShieldCheck, Upload } from "lucide-react";

import {
  saveVerificationDetails,
  submitForReview,
  uploadVerificationDocument,
  withdrawFromReview,
  type OnboardingState,
} from "@/app/(app)/onboarding/actions";
import { Badge, Button, Card, Field, Input } from "@/components/clinician/kit";
import {
  documentRequirements,
  regulatorsFor,
  type RequirementOverrides,
} from "@/lib/regulators";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import type { MissingItem } from "@/lib/data/verification";

const INITIAL: OnboardingState = {};

export type DocSlot = {
  key: "idFront" | "idBack" | "licenseDoc" | "headshot";
  /**
   * 45.6 / C207 — the label and hint arrive as dictionary keys.
   *
   * `lib/regulators.ts` is a lib module with no translator in scope, so it
   * names the key and this component resolves it. `label` is the escape
   * hatch: a per-country label an administrator typed into the country
   * config, which is a document's name rather than a string in the product.
   */
  labelKey: MessageKey;
  hintKey: MessageKey;
  label?: string;
  required: boolean;
  url: string | null;
};

function SaveButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("common.saving") : t("tset.saveDetails")}
    </Button>
  );
}

/**
 * The verification form.
 *
 * Structured as three independent saves — details, each document, then submit —
 * rather than one giant form. Someone doing this on a phone in a clinic will
 * have an upload fail; losing everything they typed because photo three timed
 * out is how an onboarding flow gets abandoned.
 */
export function VerificationForm({
  state,
  missing,
  reviewNote,
  initial,
  documents,
  countryOptions,
  languageOptions,
  specialtyOptions,
  uploadsEnabled,
  requirements,
  renewing = false,
  documentsCleared = false,
}: {
  state: "draft" | "submitted" | "approved" | "rejected";
  /** Board 562: after a second rejection the files were deleted, and the card says so. */
  documentsCleared?: boolean;
  /**
   * 🔴 W1-16: back in review because the licence ran out. The form stays
   * open so the renewal can be entered, where a plain submission is locked.
   */
  renewing?: boolean;
  /**
   * 20.4 / 20.5 — what an administrator has configured per country: which
   * regulators to offer, and what to call the documents we ask for. A country
   * with nothing configured falls through to the shipped constants, field by
   * field, so a half-filled row is better than none rather than worse.
   */
  requirements: RequirementOverrides;
  missing: MissingItem[];
  reviewNote: string | null;
  initial: {
    country: string;
    licenseBody: string;
    licenseNumber: string;
    licenseExpiry: string;
    specialties: string[];
    languages: string[];
  };
  documents: DocSlot[];
  countryOptions: { code: string; name: string; flag: string }[];
  /*
   * 🔴 37L.2 — code AND label, never one string doing both jobs.
   *
   * These used to be `readonly string[]`, and the string was the checkbox's
   * value, the thing stored on the row, the allowlist entry and the words on
   * screen all at once. Translating the words would have silently changed what
   * gets stored, so a clinician picking "القلق" would have saved a specialty
   * the allowlist does not contain.
   */
  languageOptions: { code: string; label: string }[];
  specialtyOptions: { code: string; label: string }[];
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [formState, formAction] = useActionState(saveVerificationDetails, INITIAL);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /*
   * Country is client state, not just a form field.
   *
   * Choosing it has to relabel the upload slots and offer the right regulators
   * immediately. Waiting for Save means a clinician photographs the wrong
   * document, and the labels were server-rendered until now — so this is the
   * one piece of the form that has to be held in React.
   */
  const [country, setCountry] = useState(initial.country);
  const [licenseBody, setLicenseBody] = useState(initial.licenseBody);
  const regulators = regulatorsFor(country, requirements);

  /*
   * Prefill the regulator, and replace our own prefill when the country
   * changes — but never what a clinician typed.
   *
   * The distinction is the whole thing. A first pass only filled an empty
   * field, which meant picking the UAE and then correcting it to Egypt left
   * "Department of Health – Abu Dhabi" sitting in the box: our suggestion,
   * protected as though it were theirs, on its way to a reviewer as an
   * Egyptian clinician's regulator. `ours` remembers what we last put there,
   * so we can take it back and nothing else.
   */
  const suggestion = regulators[0] ?? "";
  const [prefilledFor, setPrefilledFor] = useState(initial.country);
  const [ours, setOurs] = useState("");
  if (country !== prefilledFor) {
    setPrefilledFor(country);
    const untouched = !licenseBody.trim() || licenseBody === ours;
    if (untouched) {
      setLicenseBody(suggestion);
      setOurs(suggestion);
    }
  }

  /* Slots keep any URL already uploaded; only the wording follows the country. */
  const slots: DocSlot[] = documentRequirements(country || null, requirements).map((requirement) => ({
    ...requirement,
    url: documents.find((doc) => doc.key === requirement.key)?.url ?? null,
  }));

  const locked = (state === "submitted" && !renewing) || state === "approved";

  /*
   * 🔴 B37: the checklist follows the uploads on this screen.
   *
   * The list is built from the saved row and only moved when the page's server
   * props came back, so after three uploads each badged "uploaded" it still
   * named the photo ID and the licence as missing until a reload. A slot that
   * reports a stored upload removes its line here at once; the refresh then
   * confirms it. An upload after a rejection also reopens the submission on the
   * server (TH2.6), so it does here too.
   */
  const [landed, setLanded] = useState<DocSlot["key"][]>([]);
  const DOC_ITEM: Partial<Record<DocSlot["key"], MissingItem>> = {
    idFront: "photoId",
    licenseDoc: "licenceDoc",
    headshot: "headshot",
  };
  const satisfied = new Set(landed.map((key) => DOC_ITEM[key]));
  const outstanding = missing.filter((item) => !satisfied.has(item));
  const onLanded = (key: DocSlot["key"]) => setLanded((keys) => (keys.includes(key) ? keys : [...keys, key]));
  /* B13: rejected until something changes; an upload here is a change. */
  const awaitingChange = state === "rejected" && landed.length === 0;

  if (state === "submitted" && !renewing) {
    return (
      <Card className="p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </span>
        <p className="mt-4 text-lg font-bold tracking-tight text-navy-700">
          {t("tver.underReview")}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-navy-400">
          {t("tver.underReviewBody")}
        </p>

        {/*
          🔴 W2-T02: WHAT IS WITH US, not a spinner and a sentence.

          The same fields and documents the form held, read back. Somebody who
          noticed a wrong digit an hour after submitting could see nothing here
          and change nothing, so the button below takes it back to draft,
          which the server allows only while nobody has decided it.
        */}
        <dl className="mx-auto mt-4 max-w-md space-y-1 text-start text-sm">
          {[
            [t("tver.regulator"), initial.licenseBody],
            [t("tver.licenceNumber"), initial.licenseNumber],
            [t("tver.licenceExpiry"), initial.licenseExpiry],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-navy-400">{label}</dt>
              <dd className="font-medium text-navy-700">{value || "-"}</dd>
            </div>
          ))}
          {documents.map((doc) => (
            <div key={doc.key} className="flex justify-between gap-3">
              <dt className="text-navy-400">{doc.label ?? t(doc.labelKey)}</dt>
              <dd className="font-medium text-navy-700">{doc.url ? t("tver.uploaded") : "-"}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          <form action={withdrawFromReview}>
            <button type="submit" className="text-sm font-semibold text-brand-700">
              {t("tw2.changeSubmission")}
            </button>
          </form>
          {/* 🔴 W2-T01: the person waiting on us can ask us something. */}
          <Link href="/support" className="text-sm font-semibold text-brand-700">
            {t("portal.support.title")}
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {state === "rejected" && reviewNote ? (
        <Card className="border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">{t("tver.rejected")}</p>
          <p className="mt-1 text-sm leading-relaxed text-red-800">{reviewNote}</p>
          <p className="mt-2 text-xs text-red-700">
            {t(documentsCleared ? "tver.rejectedCleared" : "tver.rejectedBody")}
          </p>
        </Card>
      ) : null}

      {!uploadsEnabled ? (
        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          {t("tver.noUploads")}
        </p>
      ) : null}

      {/* ------------------------------------------------------ your details */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-navy-700">{t("tver.aboutPractice")}</p>

        <form action={formAction} className="mt-3 space-y-4">
          {formState.ok ? <p className="text-sm text-brand-800">{formState.message}</p> : null}
          {formState.error ? <p className="text-sm text-red-600">{formState.error}</p> : null}

          <Field
            label={t("tver.country")}
            htmlFor="country"
            hint={t("tver.countryHint")}
          >
            <select
              id="country"
              name="country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              disabled={locked}
              className="h-12 w-full rounded-xl border border-navy-100 bg-white px-3 text-navy-700 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 focus:outline-none"
            >
              <option value="">{t("tver.chooseCountry")}</option>
              {countryOptions.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("tver.regulator")}
              htmlFor="licenseBody"
              hint={t("tver.regulatorHint")}
            >
              <Input
                id="licenseBody"
                name="licenseBody"
                value={licenseBody}
                onChange={(event) => setLicenseBody(event.target.value)}
                disabled={locked}
                placeholder={suggestion || t("tver.regulatorHint")}
              />
              {/*
                Offered, not imposed. There are many routes to practising in
                most countries and a dropdown that omits yours reads as "you
                are not welcome here", so these are one-tap shortcuts beside a
                field you can type anything into.
              */}
              {!locked && regulators.length > 1 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {regulators.map((body) => (
                    <button
                      key={body}
                      type="button"
                      onClick={() => {
                        setLicenseBody(body);
                        // Chosen from our list, so it is still ours to replace
                        // if they change country again.
                        setOurs(body);
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                        licenseBody === body
                          ? "border-brand-600 bg-brand-50 text-brand-800"
                          : "border-navy-100 bg-white text-navy-400 hover:border-navy-200",
                      )}
                    >
                      {body}
                    </button>
                  ))}
                </div>
              ) : null}
            </Field>
            <Field label={t("tver.licenceNumber")} htmlFor="licenseNumber">
              <Input
                id="licenseNumber"
                name="licenseNumber"
                defaultValue={initial.licenseNumber}
                disabled={locked}
              />
            </Field>
          </div>

          <Field
            label={t("tver.licenceExpiry")}
            htmlFor="licenseExpiry"
            hint={t("tver.licenceExpiryHint")}
          >
            <Input
              id="licenseExpiry"
              name="licenseExpiry"
              defaultValue={initial.licenseExpiry}
              disabled={locked}
              placeholder="2028-04"
            />
          </Field>

          <ChipGroup
            legend={t("tver.languages")}
            name="languages"
            options={languageOptions}
            selected={initial.languages}
            disabled={locked}
          />
          <ChipGroup
            legend={t("tver.specialties")}
            name="specialties"
            options={specialtyOptions}
            selected={initial.specialties}
            disabled={locked}
          />

          {!locked ? <SaveButton /> : null}
        </form>
      </Card>

      {/* --------------------------------------------------------- documents */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-navy-700">{t("tver.documents")}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-navy-400">
          {t("tver.documentsBody")}
        </p>

        {country ? (
          <p className="mt-2 text-xs font-medium text-brand-800">
            {t("tver.showingFor", {
              country:
                countryOptions.find((c) => c.code === country)?.name ?? t("tver.thisCountry"),
            })}
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-700">
            {t("tver.chooseCountryFirst")}
          </p>
        )}

        <div className="mt-3 space-y-2.5">
          {slots.map((doc) => (
            <DocumentSlot
              key={doc.key}
              doc={doc}
              disabled={locked || !uploadsEnabled}
              onLanded={onLanded}
            />
          ))}
        </div>
      </Card>

      {/* ------------------------------------------------------------ submit */}
      {/* Nothing to submit once approved; a licence change has its own form above. */}
      {state === "approved" ? null : (
      <Card className="p-4">
        {outstanding.length > 0 ? (
          <>
            <p className="text-sm font-semibold text-navy-700">{t("tver.nearlyThere")}</p>
            {/*
              Say which copy of the truth this list is reading.

              It is built from the saved row, not from what is on screen — so
              somebody who has just filled the form in and not pressed "Save
              details" sees their own answers listed as missing, next to a
              submit button that will not respond, with nothing explaining
              either. That is a signup drop-off, and it is entirely avoidable
              with one sentence.
            */}
            <p className="mt-1 text-xs leading-relaxed text-navy-400">
              {t("tver.savedListNote")
                .split("{save}")
                .flatMap((part, index) =>
                  index === 0
                    ? [part]
                    : [
                        <span key="save" className="font-semibold text-navy-600">
                          {t("tset.saveDetails")}
                        </span>,
                        part,
                      ],
                )}
            </p>
            <ul className="mt-2 space-y-1">
              {outstanding.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-navy-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {t(`tver.missing.${item}`)}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-800">
            <Check className="h-4 w-4" aria-hidden />
            {t("tver.everythingHere")}
          </p>
        )}

        {awaitingChange ? (
          <p className="mt-3 text-sm leading-relaxed text-navy-400">{t("tver.changeFirst")}</p>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <Button
          full
          size="lg"
          className="mt-4"
          disabled={pending || outstanding.length > 0 || awaitingChange}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await submitForReview();
              if (result.error) setError(result.error);
              else router.refresh();
            })
          }
        >
          <ShieldCheck className="h-4 w-4" aria-hidden />
          {pending ? t("tver.submitting") : t("tver.submit")}
        </Button>
      </Card>
      )}
    </div>
  );
}

/**
 * One document, uploaded in place.
 *
 * `capture` is deliberately absent: on a phone it forces the camera and blocks
 * choosing an existing photo, which is exactly what someone who already
 * photographed their licence last week wants to do.
 */
function DocumentSlot({
  doc,
  disabled,
  onLanded,
}: {
  doc: DocSlot;
  disabled: boolean;
  /** B37: the server has stored this document. */
  onLanded: (key: DocSlot["key"]) => void;
}) {
  const router = useRouter();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState(doc.url);

  const upload = (file: File) =>
    startTransition(async () => {
      setError(null);
      const data = new FormData();
      data.set("file", file);
      const result = await uploadVerificationDocument(doc.key, data);
      if (result.error) setError(result.error);
      else {
        // Optimistic: the server has it, and the real URL arrives on refresh.
        setUrl(URL.createObjectURL(file));
        onLanded(doc.key);
        router.refresh();
      }
    });

  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        url ? "border-brand-200 bg-brand-50/40" : "border-navy-100",
      )}
    >
      <div className="flex items-start gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-400">
            <Camera className="h-5 w-5" aria-hidden />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium text-navy-700">
            {doc.label ?? t(doc.labelKey)}
            {doc.required ? null : <Badge tone="slate">{t("tver.optional")}</Badge>}
            {url ? <Badge tone="teal">{t("tver.uploaded")}</Badge> : null}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-navy-400">{t(doc.hintKey)}</p>
          {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
        </div>

        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => inputRef.current?.click()}
          className="tap-target flex shrink-0 items-center gap-1.5 rounded-xl border border-navy-100 bg-white px-3 text-sm font-medium text-navy-600 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Upload className="h-3.5 w-3.5" aria-hidden />
          )}
          {url ? t("tver.replace") : t("tver.upload")}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function ChipGroup({
  legend,
  name,
  options,
  selected,
  disabled,
}: {
  legend: string;
  name: string;
  options: { code: string; label: string }[];
  selected: string[];
  disabled: boolean;
}) {
  const chosen = new Set(selected);
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 block text-sm font-medium text-navy-600">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.code}
            className="cursor-pointer rounded-full border border-navy-100 px-3 py-1.5 text-xs font-medium text-navy-400 has-checked:border-brand-600 has-checked:bg-brand-50 has-checked:text-brand-800"
          >
            <input
              type="checkbox"
              name={name}
              value={option.code}
              defaultChecked={chosen.has(option.code)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
