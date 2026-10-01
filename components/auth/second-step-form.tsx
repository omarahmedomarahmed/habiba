"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, Input } from "@/components/clinician/kit";
import { signOut } from "@/lib/auth/actions";
import {
  finishStepEnrolment,
  startStepEnrolment,
  verifySecondStep,
  type SecondStepState,
  type StepEnrolState,
} from "@/lib/auth/second-step-actions";
import { useT } from "@/lib/i18n/client";

const INITIAL: SecondStepState = {};
const ENROL: StepEnrolState = {};

function Submit({ children, quiet }: { children: React.ReactNode; quiet?: boolean }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="lg" full variant={quiet ? "secondary" : undefined} disabled={pending}>
      {pending ? t("tauth.oneMoment") : children}
    </Button>
  );
}

function Problem({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      {message}
    </p>
  ) : null;
}

function SignOut() {
  const t = useT();
  return (
    <form action={signOut} className="pt-1 text-center">
      <button type="submit" className="text-sm text-navy-400 hover:text-navy-700">
        {t("tauth.secondSignOut")}
      </button>
    </form>
  );
}

/**
 * 🔴 Task 40: one code, from the authenticator app or a recovery code, and
 * the server tells them apart. DD-2 B2.3: there is no emailed code any more.
 */
export function SecondStepForm({ next }: { next: string }) {
  const t = useT();
  const [state, action] = useActionState(verifySecondStep, INITIAL);

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-navy-700">{t("tauth.secondTitle")}</h1>
        <p className="mt-1 text-sm text-navy-400">{t("tauth.secondAppBody")}</p>
      </div>

      <form action={action} className="space-y-4">
        <Problem message={state.error} />
        <input type="hidden" name="next" value={next} />
        <Field label={t("tauth.secondCode")} htmlFor="code">
          <Input id="code" name="code" autoComplete="one-time-code" inputMode="text" autoCapitalize="none" maxLength={40} required />
        </Field>
        <Submit>{t("tauth.secondVerify")}</Submit>
      </form>

      <SignOut />
    </div>
  );
}

/**
 * DD-2 B2.3: a back office member with no authenticator app sets one up here,
 * after the password and before the console. The QR code is drawn on the
 * server from the sealed pending secret; the recovery codes are shown once.
 */
export function StepEnrolment({
  next,
  available,
  pending,
}: {
  next: string;
  available: boolean;
  pending: { key: string; qr: string } | null;
}) {
  const t = useT();
  const [started, start] = useActionState(startStepEnrolment, ENROL);
  const [finished, finish] = useActionState(finishStepEnrolment, ENROL);

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-navy-700">{t("tauth.secondEnrolTitle")}</h1>
        <p className="mt-1 text-sm text-navy-400">
          {available ? t("tauth.secondEnrolBody") : t("tauth.secondEnrolUnavailable")}
        </p>
      </div>

      {finished.recoveryCodes ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-navy-700">{t("asec.codesTitle")}</p>
          <p className="text-xs text-navy-400">{t("asec.codesBody")}</p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm text-navy-700">
            {finished.recoveryCodes.map((code) => (
              <li key={code} className="rounded-md bg-navy-50 px-2 py-1">
                {code}
              </li>
            ))}
          </ul>
          <a
            href={finished.next ?? "/admin"}
            className="block rounded-xl bg-brand-500 px-4 py-3 text-center text-sm font-semibold text-navy-600"
          >
            {t("tauth.secondContinue")}
          </a>
        </div>
      ) : !available ? null : pending ? (
        <div className="space-y-3">
          <p className="text-sm text-navy-500">{t("asec.scan")}</p>
          {/* A data URL drawn on the server from the sealed secret. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pending.qr} alt={t("asec.qrAlt")} width={200} height={200} className="rounded-md border border-navy-100" />
          <p className="text-xs text-navy-400">
            {t("asec.key")}: <span className="font-mono text-navy-700">{pending.key}</span>
          </p>
          <form action={finish} className="space-y-3">
            <input type="hidden" name="next" value={next} />
            <Field label={t("asec.confirm")} htmlFor="enrolCode">
              <Input id="enrolCode" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
            </Field>
            <Problem message={finished.error} />
            <Submit>{t("asec.finish")}</Submit>
          </form>
        </div>
      ) : (
        <form action={start} className="space-y-2">
          <Problem message={started.error} />
          <Submit>{t("asec.start")}</Submit>
        </form>
      )}

      <SignOut />
    </div>
  );
}
