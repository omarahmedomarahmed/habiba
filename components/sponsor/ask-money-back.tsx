"use client";

import { useActionState } from "react";

import { askForMoneyBack, type ReturnAskState } from "@/app/(sponsor)/sponsor/pot/actions";
import { Button, Card, Textarea } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * 🔴 25 September inventory: the company's way to ask for unspent money back.
 * It moves nothing; it tells the operators, who make the transfer and its
 * credit note.
 */
export function AskMoneyBack() {
  const t = useT();
  const [state, action, pending] = useActionState(askForMoneyBack, {} as ReturnAskState);
  return (
    <Card className="p-5">
      {state.ok ? (
        <p className="text-sm text-brand-700">{t("sponsor.returns.asked")}</p>
      ) : (
        <form action={action} className="space-y-2">
          <label htmlFor="return-reason" className="text-sm font-semibold text-slate-900">
            {t("sponsor.returns.ask")}
          </label>
          <Textarea id="return-reason" name="reason" rows={2} placeholder={t("sponsor.returns.askHint")} />
          {state.error ? (
            <p role="alert" className="text-sm text-rose-600">
              {t(state.error as MessageKey)}
            </p>
          ) : null}
          <Button type="submit" variant="secondary" disabled={pending}>
            {t("sponsor.returns.askButton")}
          </Button>
        </form>
      )}
    </Card>
  );
}
