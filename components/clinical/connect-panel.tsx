"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { answerHistoryAsk, useInviteCode } from "@/app/(app)/connect/actions";
import { Button, Card, Field, Input } from "@/components/ui";

/**
 * Redeeming a patient's code. PLAN.md 27.2, 27.3, C102b, C131.
 *
 * The copy is careful in one specific way: it never implies that entering a
 * code gives the clinician anything. It asks. The patient decides, possibly
 * later, possibly not at all, and a clinician who believes otherwise will tell
 * the patient the wrong thing across a desk.
 */
export function RedeemInvite() {
  const [state, submit] = useActionState(useInviteCode, {});

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">A patient gave you a code</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        Enter it and they are asked whether you may read their history. They decide, and you will
        see the answer on their record.
      </p>

      <form action={submit} className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1">
          <Field label="Their code" htmlFor="code">
            <Input
              id="code"
              name="code"
              placeholder="ABC-DEF"
              maxLength={7}
              className="font-mono tracking-widest uppercase"
              required
            />
          </Field>
        </div>
        <Redeem />
      </form>

      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      {state.ok ? (
        <div className="mt-3 rounded-xl bg-teal-50 px-3.5 py-3">
          <p className="text-sm leading-relaxed text-teal-900">
            {state.patientName} has been asked. Nothing is shared until they say yes.
          </p>
          {state.waitingOnVerification ? (
            <p className="mt-1.5 text-sm leading-relaxed text-amber-800">
              Your licence is still being checked here, so even once they agree, access will not
              start until we approve you. They can see that too, so nobody is left wondering.
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function Redeem() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Asking…" : "Ask them"}
    </Button>
  );
}

/**
 * The queue of people asking for their history back. PLAN.md 27.7, C108.
 *
 * Two buttons and a box. "No" is as easy to press as "yes" and costs one
 * sentence, which is the trade the ruling makes: we cannot compel a clinician
 * to hand anything over, so the product makes refusing cheap and silence
 * impossible.
 */
export function HistoryAsks({
  asks,
}: {
  asks: { id: string; name: string; note: string | null; on: string }[];
}) {
  const [state, submit] = useActionState(answerHistoryAsk, {});

  if (asks.length === 0) return null;

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">
        People asking you for their own history
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        They have moved on and would like what you hold added to the record they own. You do not
        have to. If you would rather not, say so in a sentence: they read it, and hearing nothing
        is worse for them than hearing no.
      </p>

      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <ul className="mt-3 space-y-3">
        {asks.map((ask) => (
          <li key={ask.id} className="rounded-xl border border-slate-200 p-3.5">
            <p className="text-sm font-medium text-slate-900">{ask.name}</p>
            <p className="text-xs text-slate-400">Asked on {ask.on}</p>
            {ask.note ? (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">“{ask.note}”</p>
            ) : null}

            <form action={submit} className="mt-3 space-y-2">
              <input type="hidden" name="askId" value={ask.id} />
              <input
                name="reason"
                placeholder="If you are declining, why? They read this."
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  name="decision"
                  value="added"
                  className="tap-target h-10 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white"
                >
                  I have added it
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="declined"
                  className="tap-target h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700"
                >
                  Decline, with that reason
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </Card>
  );
}
