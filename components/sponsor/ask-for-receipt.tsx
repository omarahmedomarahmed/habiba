"use client";

import { useActionState } from "react";

import { askForReceipt, type ReturnAskState } from "@/app/(sponsor)/sponsor/pot/actions";
import { Button } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * 🔴 B19: a receipt we cannot issue yet comes with a way to ask for it. The
 * press tells the operators which details Settings is missing; nothing about
 * the payment changes.
 */
export function AskForReceipt({ txn }: { txn: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(askForReceipt, {} as ReturnAskState);
  if (state.ok) {
    return <p className="mt-3 text-sm text-brand-700">{t("sponsor.inv.asked")}</p>;
  }
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="txn" value={txn} />
      {state.error ? (
        <p role="alert" className="text-sm text-rose-600">
          {t(state.error as MessageKey)}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("sponsor.inv.ask")}
      </Button>
    </form>
  );
}
