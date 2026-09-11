"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { openTicket, type ReaderState } from "@/app/support/[token]/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

const INITIAL: ReaderState = {};

/**
 * 20.22 — the code, and then the whole ticket.
 *
 * The failure message is the same whether the token is unknown or the code is
 * wrong. Distinguishing them would turn this page into an oracle for valid
 * references, which is a small thing that matters here: a reference identifies
 * somebody who wrote to a therapy service.
 */
function Open() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" full disabled={pending}>
      {pending ? "Checking…" : "Read the reply"}
    </Button>
  );
}

export function TicketReader({ token }: { token: string }) {
  const t = useT();
  const [state, action] = useActionState(openTicket, INITIAL);

  if (state.ticket) {
    return (
      <div className="space-y-3">
        <Card className="p-4">
          <p className="text-xs text-slate-400">Reference {state.ticket.reference}</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{t("ttk.whatYouWrote")}</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {state.ticket.message}
          </p>
        </Card>

        {state.ticket.events.map((event, i) => (
          <Card key={i} className="p-4">
            <p className="text-sm font-semibold text-slate-900">
              {event.kind === "closed" ? "Our reply" : "Update"}
            </p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {event.note}
            </p>
            <p className="mt-2 text-xs text-slate-400">{event.atLabel}</p>
          </Card>
        ))}

        <p className="text-xs leading-relaxed text-slate-500">
          {t("ttk.writeAgain")}
        </p>
      </div>
    );
  }

  return (
    <Card className="p-5">
      <form action={action} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <Field label="Your six-digit code" htmlFor="code">
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
          />
        </Field>
        {state.error ? (
          <p role="alert" className="text-sm text-rose-600">
            {state.error}
          </p>
        ) : null}
        <Open />
      </form>
    </Card>
  );
}
