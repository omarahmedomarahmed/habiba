"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { payClinicBills, type PayState } from "@/app/(clinic)/clinic/bills/actions";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button size="sm" type="submit" disabled={pending}>
      {pending ? t("common.working") : label}
    </Button>
  );
}

/**
 * 🔴 W2-C03: pay what the practice owes. The amount is the server's, already
 * formatted; the action reads the due invoices again itself, so nothing here
 * decides what is paid.
 */
export function PayClinicBills({ amountLabel }: { amountLabel: string }) {
  const t = useT();
  const [state, action] = useActionState(
    async (_prev: PayState) => payClinicBills(),
    {} as PayState,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <Submit label={t("pay.payAmount", { amount: amountLabel })} />
      {state.error ? (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
