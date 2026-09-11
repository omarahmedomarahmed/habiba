"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { changePassword, signOut, type ActionState } from "@/lib/auth/actions";
import { updateProfile, type SettingsState } from "@/app/(app)/settings/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

const INITIAL_SETTINGS: SettingsState = {};
const INITIAL_AUTH: ActionState = {};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" full disabled={pending}>
      {pending ? t("common.saving") : label}
    </Button>
  );
}

/**
 * 24.4 — three separate things, three separate components.
 *
 * These were one component rendering three cards in a row: your details, your
 * password, and a sign-out button. That made them one block on the page, which
 * is why the settings screen could not be organised by what somebody came to
 * do. They are exported separately now and placed into sections by the page.
 */
export function ProfileForm({
  initial,
}: {
  initial: {
    firstName: string;
    lastName: string;
    credentials: string;
    licenseType: string;
    licenseNumber: string;
    licenseState: string;
  };
}) {
  const [profileState, profileAction] = useActionState(updateProfile, INITIAL_SETTINGS);
  const t = useT();

  return (
    <>
      <Card className="p-4">
        <form action={profileAction} className="space-y-4">
          <p className="text-sm font-semibold text-slate-900">{t("tset.details")}</p>

          {profileState.ok ? <p className="text-sm text-emerald-700">{t("common.saved")}</p> : null}
          {profileState.error ? (
            <p role="alert" className="text-sm text-red-700">
              {profileState.error}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("tauth.firstName")} htmlFor="firstName">
              <Input id="firstName" name="firstName" defaultValue={initial.firstName} required />
            </Field>
            <Field label={t("tauth.lastName")} htmlFor="lastName">
              <Input id="lastName" name="lastName" defaultValue={initial.lastName} />
            </Field>
          </div>

          <Field
            label={t("tset.credentials")}
            htmlFor="credentials"
            hint={t("tset.credentialsHint")}
          >
            <Input
              id="credentials"
              name="credentials"
              placeholder={t("tset.credentialsPlaceholder")}
              defaultValue={initial.credentials}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("tset.licenceType")} htmlFor="licenseType">
              <Input id="licenseType" name="licenseType" defaultValue={initial.licenseType} />
            </Field>
            <Field label={t("tset.licenceState")} htmlFor="licenseState">
              <Input id="licenseState" name="licenseState" defaultValue={initial.licenseState} />
            </Field>
          </div>

          <Field
            label={t("tset.licenceNumber")}
            htmlFor="licenseNumber"
            hint={t("tset.licenceNumberHint")}
          >
            <Input id="licenseNumber" name="licenseNumber" defaultValue={initial.licenseNumber} />
          </Field>

          <Submit label={t("tset.saveDetails")} />
        </form>
      </Card>

    </>
  );
}

export function PasswordForm() {
  const [passwordState, passwordAction] = useActionState(changePassword, INITIAL_AUTH);
  const t = useT();

  return (
    <>
      <Card className="p-4">
        <form action={passwordAction} className="space-y-4">
          <p className="text-sm font-semibold text-slate-900">{t("tset.password")}</p>
          <p className="text-xs text-slate-500">
            {t("tset.passwordBody")}
          </p>

          {passwordState.error ? (
            <p role="alert" className="text-sm text-red-700">
              {passwordState.error}
            </p>
          ) : null}

          <Field label={t("tset.currentPassword")} htmlFor="currentPassword">
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <Field label={t("tauth.newPassword")} htmlFor="newPassword" hint={t("tauth.passwordHint")}>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>

          <Submit label={t("tset.changePassword")} />
        </form>
      </Card>

      <Card className="p-4">
        <form action={signOut}>
          <Button type="submit" variant="secondary" full>
            {t("portal.nav.signOut")}
          </Button>
        </form>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {t("tset.signOutBody")}
        </p>
      </Card>
    </>
  );
}
