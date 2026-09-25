"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { finishEnrolment, startEnrolment, type EnrolState } from "@/app/(admin)/admin/security/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

const INITIAL: EnrolState = {};

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
    <p role="alert" className="text-xs text-rose-600">
      {message}
    </p>
  ) : null;
}

/**
 * 🔴 Task 40: set up an authenticator app, once, and see the recovery codes,
 * once. Replacing a working app is a reset, which is the owner's (Team).
 */
export function SecondFactorSetup({
  enrolled,
  recoveryLeft,
  available,
  pending,
}: {
  enrolled: boolean;
  recoveryLeft: number;
  available: boolean;
  pending: { key: string; qr: string } | null;
}) {
  const t = useT();
  const [startState, start] = useActionState(startEnrolment, INITIAL);
  const [finishState, finish] = useActionState(finishEnrolment, INITIAL);

  if (finishState.recoveryCodes) {
    return (
      <Card className="space-y-3 p-4">
        <p className="text-sm font-semibold text-slate-900">{t("asec.codesTitle")}</p>
        <p className="text-xs text-slate-500">{t("asec.codesBody")}</p>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm text-slate-900">
          {finishState.recoveryCodes.map((code) => (
            <li key={code} className="rounded-md bg-slate-50 px-2 py-1">
              {code}
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm font-semibold text-slate-900">{t("asec.title")}</p>

      {enrolled ? (
        <>
          <p className="text-sm text-slate-600">{t("asec.onApp", { count: recoveryLeft })}</p>
          <p className="text-xs text-slate-500">{t("asec.resetHint")}</p>
        </>
      ) : !available ? (
        <p className="text-sm text-slate-600">{t("asec.unavailable")}</p>
      ) : pending ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{t("asec.scan")}</p>
          {/* A data URL drawn on the server from the sealed secret. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pending.qr} alt={t("asec.qrAlt")} width={200} height={200} className="rounded-md border border-slate-200" />
          <p className="text-xs text-slate-500">
            {t("asec.key")}: <span className="font-mono text-slate-900">{pending.key}</span>
          </p>
          <form action={finish} className="flex flex-wrap items-end gap-2">
            <div className="w-40">
              <Field label={t("asec.confirm")} htmlFor="enrolCode">
                <Input id="enrolCode" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
              </Field>
            </div>
            <Go label={t("asec.finish")} />
          </form>
          <Problem message={finishState.error} />
        </div>
      ) : (
        <form action={start} className="space-y-2">
          <p className="text-sm text-slate-600">{t("asec.onEmail")}</p>
          <Go label={t("asec.start")} />
          <Problem message={startState.error} />
        </form>
      )}
    </Card>
  );
}
