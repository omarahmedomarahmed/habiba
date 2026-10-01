"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Card, Field, Input } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";

export type AuthenticatorState = { error?: string; recoveryCodes?: string[]; removed?: boolean };
type Action = (prev: AuthenticatorState, formData: FormData) => Promise<AuthenticatorState>;

const INITIAL: AuthenticatorState = {};

function Go({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? t("common.working") : label}
    </Button>
  );
}

function Problem({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-xs text-red-700">
      {message}
    </p>
  ) : null;
}

/**
 * DD-2 B2.4: an optional authenticator app, for a clinician, a clinic manager
 * or a partner user, on their own settings. The same steps as the console's:
 * scan, confirm with the first code, keep the ten recovery codes (shown once).
 * Turning it off takes a code from it, so a borrowed session cannot.
 */
export function AuthenticatorCard({
  enrolled,
  recoveryLeft,
  available,
  pending,
  start,
  finish,
  remove,
}: {
  enrolled: boolean;
  recoveryLeft: number;
  available: boolean;
  pending: { key: string; qr: string } | null;
  start: Action;
  finish: Action;
  remove: Action;
}) {
  const t = useT();
  const [started, startAction] = useActionState(start, INITIAL);
  const [finished, finishAction] = useActionState(finish, INITIAL);
  const [removed, removeAction] = useActionState(remove, INITIAL);

  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm font-semibold text-navy-700">{t("asec.title")}</p>

      {finished.recoveryCodes ? (
        <>
          <p className="text-sm font-semibold text-navy-700">{t("asec.codesTitle")}</p>
          <p className="text-xs text-navy-400">{t("asec.codesBody")}</p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm text-navy-700">
            {finished.recoveryCodes.map((code) => (
              <li key={code} className="rounded-md bg-navy-50 px-2 py-1">
                {code}
              </li>
            ))}
          </ul>
        </>
      ) : removed.removed ? (
        <p className="text-sm text-navy-500">{t("asec.off")}</p>
      ) : enrolled ? (
        <>
          <p className="text-sm text-navy-500">{t("asec.onApp", { count: recoveryLeft })}</p>
          <p className="text-xs text-navy-400">{t("asec.lostPhone")}</p>
          <form action={removeAction} className="flex flex-wrap items-end gap-2">
            <div className="w-56">
              <Field label={t("asec.turnOffCode")} htmlFor="authenticatorOff">
                <Input id="authenticatorOff" name="code" autoComplete="one-time-code" maxLength={40} required />
              </Field>
            </div>
            <Go label={t("asec.turnOff")} />
          </form>
          <Problem message={removed.error} />
        </>
      ) : !available ? (
        <p className="text-sm text-navy-500">{t("asec.unavailable")}</p>
      ) : pending ? (
        <div className="space-y-3">
          <p className="text-sm text-navy-500">{t("asec.scan")}</p>
          {/* A data URL drawn on the server from the sealed secret. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pending.qr} alt={t("asec.qrAlt")} width={200} height={200} className="rounded-md border border-navy-100" />
          <p className="text-xs text-navy-400">
            {t("asec.key")}: <span className="font-mono text-navy-700">{pending.key}</span>
          </p>
          <form action={finishAction} className="flex flex-wrap items-end gap-2">
            <div className="w-40">
              <Field label={t("asec.confirm")} htmlFor="authenticatorCode">
                <Input id="authenticatorCode" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
              </Field>
            </div>
            <Go label={t("asec.finish")} />
          </form>
          <Problem message={finished.error} />
        </div>
      ) : (
        <form action={startAction} className="space-y-2">
          <p className="text-sm text-navy-500">{t("asec.optionalBody")}</p>
          <div className="w-56">
            <Field label={t("asec.password")} htmlFor="authenticatorPassword">
              <Input id="authenticatorPassword" name="password" type="password" autoComplete="current-password" required />
            </Field>
          </div>
          <Go label={t("asec.start")} />
          <Problem message={started.error} />
        </form>
      )}
    </Card>
  );
}
