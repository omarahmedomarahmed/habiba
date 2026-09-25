"use client";

import { useActionState } from "react";

import {
  askPotReturn,
  cancelAskedReturn,
  sendAskedReturn,
  type AdminSponsorState,
} from "@/app/(admin)/admin/sponsors/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { Money } from "@/components/ui/money";
import { MIN_REASON } from "@/lib/admin/reason";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * 🔴 0148: money back out of a pot. One person asks; a different person makes
 * the transfer and records its reference. The credit note follows by itself.
 */
export function PotReturns({
  sponsorId,
  open,
  history,
}: {
  sponsorId: string;
  open: {
    id: string;
    netCents: number;
    egpMinor: number;
    reason: string;
    /** K23: the reason a cancel was asked for, and whether this reader asked it. */
    cancelAsked: string | null;
    cancelAskedByMe: boolean;
  } | null;
  history: { id: string; day: string; state: string; egpMinor: number; reference: string | null }[];
}) {
  const t = useT();
  /* B57: sent and cancelled in words, not the state code. */
  const stateLabel = (state: string) => t(`apot.state.${state}` as MessageKey);
  const [asked, ask] = useActionState<AdminSponsorState, FormData>(askPotReturn, {});
  const [sent, send] = useActionState<AdminSponsorState, FormData>(sendAskedReturn, {});
  const [cancelled, cancel] = useActionState<AdminSponsorState, FormData>(cancelAskedReturn, {});
  const error = asked.error ?? sent.error ?? cancelled.error;
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">Return unused money</p>
      {open ? (
        <div className="mt-2 space-y-2 text-sm text-slate-700">
          <p>
            Asked: <Money cents={open.netCents} /> credit, <Money cents={open.egpMinor} currency="EGP" asIs /> to send. {open.reason}
          </p>
          <form action={send} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="returnId" value={open.id} />
            <input type="hidden" name="sponsorId" value={sponsorId} />
            <Field label="Bank reference" htmlFor="ret-ref">
              <Input id="ret-ref" name="reference" />
            </Field>
            <Button type="submit">Sent</Button>
          </form>
          {/*
            🔴 K23: a cancel carries a reason at the console's length, and while
            company returns need two people a different person carries it out.
          */}
          {open.cancelAsked !== null ? (
            <form action={cancel} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="returnId" value={open.id} />
              <input type="hidden" name="sponsorId" value={sponsorId} />
              <span className="text-xs text-slate-600">{t("apot.cancelAsked", { reason: open.cancelAsked })}</span>
              {open.cancelAskedByMe ? (
                <span className="text-xs text-amber-700">{t("apot.cancelTwo")}</span>
              ) : (
                <Button type="submit" size="sm" variant="secondary">
                  {t("apot.cancelConfirm")}
                </Button>
              )}
            </form>
          ) : (
            <form action={cancel} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="returnId" value={open.id} />
              <input type="hidden" name="sponsorId" value={sponsorId} />
              <Field label={t("apot.cancelWhy")} htmlFor="ret-cancel-why">
                <Input id="ret-cancel-why" name="reason" required minLength={MIN_REASON} />
              </Field>
              <Button type="submit" size="sm" variant="secondary">
                {t("apot.cancelAsk")}
              </Button>
            </form>
          )}
          {cancelled.asked ? <p className="text-xs text-brand-700">{t("apot.cancelAskedDone")}</p> : null}
        </div>
      ) : (
        <form action={ask} className="mt-2 grid gap-2 sm:grid-cols-3">
          <input type="hidden" name="sponsorId" value={sponsorId} />
          <Field label="Credit ($)" htmlFor="ret-credit">
            <Input id="ret-credit" name="credit" type="number" step="0.01" min="0.01" />
          </Field>
          <Field label="Pounds to send" htmlFor="ret-egp">
            <Input id="ret-egp" name="egp" type="number" step="0.01" min="0.01" />
          </Field>
          <Field label="Why" htmlFor="ret-why">
            <Input id="ret-why" name="reason" />
          </Field>
          <div className="sm:col-span-3">
            <Button type="submit">Ask</Button>
          </div>
        </form>
      )}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      {history.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          {history.map((h) => (
            <li key={h.id}>
              {h.day} {stateLabel(h.state)} <Money cents={h.egpMinor} currency="EGP" asIs />
              {h.reference ? ` · ${h.reference}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
