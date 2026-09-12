"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { answerHistoryAsk, useInviteCode } from "@/app/(app)/connect/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/**
 * Redeeming a patient's code. PLAN.md 27.2, 27.3, C102b, C131.
 *
 * The copy is careful in one specific way: it never implies that entering a
 * code gives the clinician anything. It asks. The patient decides, possibly
 * later, possibly not at all, and a clinician who believes otherwise will tell
 * the patient the wrong thing across a desk.
 */
export function RedeemInvite() {
  const t = useT();
  const [state, submit] = useActionState(useInviteCode, {});

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">{t("tcon.gaveCode")}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        {t("tcon.gaveCodeBody")}
      </p>

      <form action={submit} className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1">
          <Field label={t("tcon.theirCode")} htmlFor="code">
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
            {t("tcon.asked", { name: state.patientName ?? "" })}
          </p>
          {state.waitingOnVerification ? (
            <p className="mt-1.5 text-sm leading-relaxed text-amber-800">
              {t("tcon.notClearedYet")}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function Redeem() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("tcon.asking2") : t("tcon.askThem")}
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
  const t = useT();
  const [state, submit] = useActionState(answerHistoryAsk, {});

  if (asks.length === 0) return null;

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">
        {t("tcon.asking")}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        {t("tcon.askingBody")}
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
            <p className="text-xs text-slate-400">{t("tcon.askedOn", { date: ask.on })}</p>
            {ask.note ? (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">“{ask.note}”</p>
            ) : null}

            <form action={submit} className="mt-3 space-y-2">
              <input type="hidden" name="askId" value={ask.id} />
              <input
                name="reason"
                placeholder={t("tcon.declinePlaceholder")}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  name="decision"
                  value="added"
                  className="tap-target h-10 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white"
                >
                  {t("tcon.added")}
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="declined"
                  className="tap-target h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700"
                >
                  {t("tcon.decline")}
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </Card>
  );
}
