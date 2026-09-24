"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { payClinicBills, type PayState } from "@/app/(clinic)/clinic/bills/actions";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { Money } from "@/components/ui/money";
import { rich, slot } from "@/lib/i18n/rich";

function Submit({ label }: { label: React.ReactNode }) {
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
export function PayClinicBills({ amountCents }: { amountCents: number }) {
  const t = useT();
  const [state, action] = useActionState(
    async (_prev: PayState) => payClinicBills(),
    {} as PayState,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <Submit label={rich(t("pay.payAmount", { amount: slot(0) }), [<Money cents={amountCents} />])} />
      {state.error ? (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
