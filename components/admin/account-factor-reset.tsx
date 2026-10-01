"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { resetAccountAuthenticator, type AccountResetState } from "@/app/(admin)/admin/security/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { FACTOR_RESET_TARGETS } from "@/lib/auth/factor-reset";
import { useT } from "@/lib/i18n/client";

const INITIAL: AccountResetState = {};

function Go({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? t("common.working") : label}
    </Button>
  );
}

/**
 * Review fix: an owner or a manager resets a clinician's, clinic manager's or
 * partner user's authenticator app, when they lost the phone and the recovery
 * codes. Named by email; the server writes an audit row either way.
 */
export function AccountFactorReset() {
  const t = useT();
  const [state, action] = useActionState(resetAccountAuthenticator, INITIAL);
  const labels = {
    clinician: t("asec.resetTarget.clinician"),
    clinic: t("asec.resetTarget.clinic"),
    partner: t("asec.resetTarget.partner"),
  } as const;

  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm font-semibold text-slate-900">{t("asec.resetOthersTitle")}</p>
      <p className="text-xs text-slate-500">{t("asec.resetOthersBody")}</p>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div className="w-44">
          <Field label={t("asec.resetWho")} htmlFor="resetTarget">
            <select
              id="resetTarget"
              name="target"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
              defaultValue="clinician"
            >
              {FACTOR_RESET_TARGETS.map((target) => (
                <option key={target} value={target}>
                  {labels[target]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="w-64">
          <Field label={t("asec.resetEmail")} htmlFor="resetEmail">
            <Input id="resetEmail" name="email" type="email" autoComplete="off" required />
          </Field>
        </div>
        <Go label={t("asec.resetDo")} />
      </form>
      {state.error ? (
        <p role="alert" className="text-xs text-rose-600">
          {state.error}
        </p>
      ) : state.done ? (
        <p className="text-xs text-emerald-700">{t("asec.resetDone")}</p>
      ) : null}
    </Card>
  );
}
