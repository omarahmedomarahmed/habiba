"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { removeOwnPhoto, saveOwnName, saveOwnPhoto } from "@/app/(patient)/patient/account/actions";
import { PatientAvatar } from "@/components/patient/avatar";
import { Button, Card, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/**
 * Name and picture. PLAN.md 25.7, C115.
 *
 * ## What it deliberately does not offer
 *
 * No cropper, no filters, no "choose from our avatars". A patient app is not a
 * social product and the picture exists for one reason: a clinician opening a
 * caseload should recognise the person they are about to talk to. Anything
 * beyond "pick a photo, or take one" is a feature we would then have to
 * maintain on a four-year-old Android.
 *
 * `capture` is not set, so the phone offers the camera *and* the gallery. A
 * person photographing themselves in a waiting room and a person picking a
 * photo they already like are both normal, and forcing the first is rude.
 */
export function IdentityEditor({
  personId,
  firstName,
  lastName,
  hasPhoto,
}: {
  personId: string;
  firstName: string;
  lastName: string | null;
  hasPhoto: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [named, saveName] = useActionState(saveOwnName, {});
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [busy, startPhoto] = useTransition();
  const picker = useRef<HTMLInputElement>(null);

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-center gap-4">
        <PatientAvatar
          personId={personId}
          hasPhoto={hasPhoto}
          name={firstName}
          size={64}
          /* Cache-busting is the router refresh below, not a query string. */
        />
        <div className="min-w-0 space-y-1.5">
          <input
            ref={picker}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const data = new FormData();
              data.set("photo", file);
              startPhoto(async () => {
                const result = await saveOwnPhoto(data);
                setPhotoError(result.error ?? null);
                if (!result.error) router.refresh();
              });
              event.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => picker.current?.click()}
            className="block text-sm font-semibold text-brand-600"
          >
            {busy ? "Uploading…" : hasPhoto ? "Change your photo" : "Add a photo"}
          </button>
          {hasPhoto ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                startPhoto(async () => {
                  await removeOwnPhoto();
                  router.refresh();
                })
              }
              className="block text-xs font-medium text-slate-500"
            >
              {t("pidentity.removePhoto")}
            </button>
          ) : null}
        </div>
      </div>

      {photoError ? (
        <p role="alert" className="text-sm text-red-600">
          {photoError}
        </p>
      ) : null}

      <p className="text-xs leading-relaxed text-slate-500">
        {t("pidentity.photoPrivateRecord")}
      </p>

      <form action={saveName} className="space-y-3">
        <Field label="First name" htmlFor="firstName">
          <Input id="firstName" name="firstName" defaultValue={firstName} required maxLength={80} />
        </Field>
        <Field label="Last name" htmlFor="lastName">
          <Input id="lastName" name="lastName" defaultValue={lastName ?? ""} maxLength={80} />
        </Field>

        {named.error ? (
          <p role="alert" className="text-sm text-red-600">
            {named.error}
          </p>
        ) : null}
        {named.ok ? (
          <p role="status" className="text-sm text-teal-700">
            {t("common.saved")}
          </p>
        ) : null}

        <SaveName />
      </form>
    </Card>
  );
}

function SaveName() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save your name"}
    </Button>
  );
}
