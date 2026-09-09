"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { changePassword, signOut, type ActionState } from "@/lib/auth/actions";
import { updateProfile, type SettingsState } from "@/app/(app)/settings/actions";
import { Button, Card, Field, Input } from "@/components/ui";

const INITIAL_SETTINGS: SettingsState = {};
const INITIAL_AUTH: ActionState = {};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" full disabled={pending}>
      {pending ? "Saving…" : label}
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

  return (
    <>
      <Card className="p-4">
        <form action={profileAction} className="space-y-4">
          <p className="text-sm font-semibold text-slate-900">Your details</p>

          {profileState.ok ? <p className="text-sm text-emerald-700">Saved</p> : null}
          {profileState.error ? (
            <p role="alert" className="text-sm text-red-700">
              {profileState.error}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="firstName">
              <Input id="firstName" name="firstName" defaultValue={initial.firstName} required />
            </Field>
            <Field label="Last name" htmlFor="lastName">
              <Input id="lastName" name="lastName" defaultValue={initial.lastName} />
            </Field>
          </div>

          <Field
            label="Credentials"
            htmlFor="credentials"
            hint="Shown on the reports you send to patients."
          >
            <Input
              id="credentials"
              name="credentials"
              placeholder="LCSW"
              defaultValue={initial.credentials}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Licence type" htmlFor="licenseType">
              <Input id="licenseType" name="licenseType" defaultValue={initial.licenseType} />
            </Field>
            <Field label="Licence state" htmlFor="licenseState">
              <Input id="licenseState" name="licenseState" defaultValue={initial.licenseState} />
            </Field>
          </div>

          <Field
            label="Licence number"
            htmlFor="licenseNumber"
            hint="Optional. Nothing here gates your ability to record sessions."
          >
            <Input id="licenseNumber" name="licenseNumber" defaultValue={initial.licenseNumber} />
          </Field>

          <Submit label="Save details" />
        </form>
      </Card>

    </>
  );
}

export function PasswordForm() {
  const [passwordState, passwordAction] = useActionState(changePassword, INITIAL_AUTH);

  return (
    <>
      <Card className="p-4">
        <form action={passwordAction} className="space-y-4">
          <p className="text-sm font-semibold text-slate-900">Password</p>
          <p className="text-xs text-slate-500">
            Changing your password signs you out on every device.
          </p>

          {passwordState.error ? (
            <p role="alert" className="text-sm text-red-700">
              {passwordState.error}
            </p>
          ) : null}

          <Field label="Current password" htmlFor="currentPassword">
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <Field label="New password" htmlFor="newPassword" hint="At least 10 characters.">
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>

          <Submit label="Change password" />
        </form>
      </Card>

      <Card className="p-4">
        <form action={signOut}>
          <Button type="submit" variant="secondary" full>
            Sign out
          </Button>
        </form>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Signing out here signs you out on this device. Changing your password above signs you
          out everywhere.
        </p>
      </Card>
    </>
  );
}
