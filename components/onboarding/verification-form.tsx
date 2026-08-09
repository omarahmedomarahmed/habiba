"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, ShieldCheck, Upload } from "lucide-react";

import {
  saveVerificationDetails,
  submitForReview,
  uploadVerificationDocument,
  type OnboardingState,
} from "@/app/(app)/onboarding/actions";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

const INITIAL: OnboardingState = {};

export type DocSlot = {
  key: "idFront" | "idBack" | "licenseDoc" | "headshot";
  label: string;
  hint: string;
  required: boolean;
  url: string | null;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save details"}
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
}: {
  state: "draft" | "submitted" | "approved" | "rejected";
  missing: string[];
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
  languageOptions: readonly string[];
  specialtyOptions: readonly string[];
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const [formState, formAction] = useActionState(saveVerificationDetails, INITIAL);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const locked = state === "submitted" || state === "approved";

  if (state === "submitted") {
    return (
      <Card className="p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </span>
        <p className="mt-4 text-lg font-bold tracking-tight text-slate-900">With us for review</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          A person is checking your documents — usually within a working day. We will email you the
          moment it is done. You can look around the product in the meantime; sessions unlock as
          soon as you are approved.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {state === "rejected" && reviewNote ? (
        <Card className="border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">We could not verify you yet</p>
          <p className="mt-1 text-sm leading-relaxed text-red-800">{reviewNote}</p>
          <p className="mt-2 text-xs text-red-700">
            Fix what is described above and submit again — it goes back to the front of the queue.
          </p>
        </Card>
      ) : null}

      {!uploadsEnabled ? (
        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          File storage is not configured on this deployment, so uploads will fail. Set
          BLOB_READ_WRITE_TOKEN.
        </p>
      ) : null}

      {/* ------------------------------------------------------ your details */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">About your practice</p>

        <form action={formAction} className="mt-3 space-y-4">
          {formState.ok ? <p className="text-sm text-emerald-700">{formState.message}</p> : null}
          {formState.error ? <p className="text-sm text-red-600">{formState.error}</p> : null}

          <Field
            label="Country you practise in"
            htmlFor="country"
            hint="This decides which documents we ask for and where you appear on the radar."
          >
            <select
              id="country"
              name="country"
              defaultValue={initial.country}
              disabled={locked}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none"
            >
              <option value="">Choose a country</option>
              {countryOptions.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Regulator or licensing body"
              htmlFor="licenseBody"
              hint="Whoever issued your licence."
            >
              <Input
                id="licenseBody"
                name="licenseBody"
                defaultValue={initial.licenseBody}
                disabled={locked}
                placeholder="Egyptian Syndicate of Psychologists"
              />
            </Field>
            <Field label="Licence number" htmlFor="licenseNumber">
              <Input
                id="licenseNumber"
                name="licenseNumber"
                defaultValue={initial.licenseNumber}
                disabled={locked}
              />
            </Field>
          </div>

          <Field label="Licence expiry" htmlFor="licenseExpiry" hint="Optional. YYYY-MM if you know it.">
            <Input
              id="licenseExpiry"
              name="licenseExpiry"
              defaultValue={initial.licenseExpiry}
              disabled={locked}
              placeholder="2028-04"
            />
          </Field>

          <ChipGroup
            legend="Languages you can work in"
            name="languages"
            options={languageOptions}
            selected={initial.languages}
            disabled={locked}
          />
          <ChipGroup
            legend="What you work with"
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
        <p className="text-sm font-semibold text-slate-900">Documents</p>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-500">
          Photos are fine — take them with your phone. Everything except the headshot is private
          to our compliance team and is never shown to patients or other clinicians.
        </p>

        <div className="mt-3 space-y-2.5">
          {documents.map((doc) => (
            <DocumentSlot key={doc.key} doc={doc} disabled={locked || !uploadsEnabled} />
          ))}
        </div>
      </Card>

      {/* ------------------------------------------------------------ submit */}
      <Card className="p-4">
        {missing.length > 0 ? (
          <>
            <p className="text-sm font-semibold text-slate-900">Nearly there</p>
            <ul className="mt-2 space-y-1">
              {missing.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {item}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <Check className="h-4 w-4" aria-hidden />
            Everything is here.
          </p>
        )}

        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <Button
          full
          size="lg"
          className="mt-4"
          disabled={pending || missing.length > 0}
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
          {pending ? "Submitting…" : "Submit for verification"}
        </Button>
      </Card>
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
function DocumentSlot({ doc, disabled }: { doc: DocSlot; disabled: boolean }) {
  const router = useRouter();
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
        router.refresh();
      }
    });

  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        url ? "border-teal-200 bg-teal-50/40" : "border-slate-200",
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
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <Camera className="h-5 w-5" aria-hidden />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
            {doc.label}
            {doc.required ? null : <Badge tone="slate">optional</Badge>}
            {url ? <Badge tone="teal">uploaded</Badge> : null}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{doc.hint}</p>
          {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
        </div>

        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => inputRef.current?.click()}
          className="tap-target flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Upload className="h-3.5 w-3.5" aria-hidden />
          )}
          {url ? "Replace" : "Upload"}
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
  options: readonly string[];
  selected: string[];
  disabled: boolean;
}) {
  const chosen = new Set(selected);
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 block text-sm font-medium text-slate-700">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option}
            className="cursor-pointer rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:text-brand-700"
          >
            <input
              type="checkbox"
              name={name}
              value={option}
              defaultChecked={chosen.has(option)}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
