"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { declarePotTransfer } from "@/app/(sponsor)/sponsor/pot/actions";
import { Button, Card } from "@/components/ui";

/**
 * An Egyptian company's way in. 73.13.
 *
 * ## 🔴 THIS IS NOT THE CARD FORM WITH A DIFFERENT BUTTON
 *
 * `TopUpForm` charges a card and the pot moves. This takes a CLAIM that money
 * was sent, and the pot does not move until an operator has seen it arrive. The
 * two are never both rendered: `sponsorNeedsTransfer` reads the same `entity`
 * column `topUpPot` refuses on, so a sponsor is on exactly one rail.
 *
 * ## 🔴 THE HEADING SAYS "BANK TRANSFER", NOT "INSTAPAY"
 *
 * Same account underneath as the patient sees. A finance team filing this
 * against an invoice recognises the first and would be puzzled by a consumer
 * brand; the patient on their phone is the other way round. The word is chosen
 * on the server by audience.
 */
export function TransferTopUp({
  fields,
  cardsComingSoon,
  waiting,
  minimumLabel,
}: {
  fields: { key: string; label: string; value: string; hint: string }[];
  cardsComingSoon: boolean;
  /** True when a declaration is already with an operator. */
  waiting: boolean;
  minimumLabel: string;
}) {
  const [state, action] = useActionState(declarePotTransfer, {} as { error?: string; ok?: boolean });

  if (waiting) {
    return (
      <Card className="border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-900">We are checking your transfer</p>
        <p className="mt-1 text-sm text-amber-900/90">
          Usually a few minutes. You can close this page.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-slate-900">Bank Transfer</p>
      <p className="mt-1 text-sm text-slate-600">
        Send at least {minimumLabel}, then tell us below.
      </p>

      {fields.length === 0 ? (
        /*
          🔴 An empty list SAYS it is empty. Rendering nothing here would look
          like a form somebody forgot to finish, and a finance team would sit on
          it rather than ask.
        */
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          Not on the system yet. Tell us and we will send them over.
        </p>
      ) : (
        <dl className="mt-4 space-y-2">
          {fields.map((f) => (
            <div key={f.key} className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">{f.label}</dt>
              {/* Selectable: they are copying this into a banking portal. */}
              <dd className="mt-0.5 font-mono text-sm break-all text-slate-900 select-all">
                {f.value}
              </dd>
              {f.hint ? <p className="mt-1 text-[11px] text-slate-500">{f.hint}</p> : null}
            </div>
          ))}
        </dl>
      )}

      {cardsComingSoon ? (
        <p className="mt-3 text-xs text-slate-500">Card payments coming soon.</p>
      ) : null}

      <form action={action} className="mt-5 space-y-3 border-t border-slate-100 pt-4">
        <label className="block text-sm font-medium text-slate-800">
          How much you sent
          <input
            name="amount"
            inputMode="decimal"
            placeholder="10000"
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          The transfer reference
          <input
            name="reference"
            placeholder="From your bank"
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
          />
        </label>

        {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
        <Declare />
      </form>
    </Card>
  );
}

function Declare() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-11 w-full">
      {pending ? "Sending…" : "I have sent it"}
    </Button>
  );
}
