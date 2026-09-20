"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Mail } from "lucide-react";

import { sendEveryTemplate, type AdminActionState } from "@/app/(admin)/admin/actions";
import { Button, Card, Field, Input } from "@/components/ui";

/**
 * 🔴 77.12 — LOOK AT EVERY EMAIL THIS PRODUCT SENDS, FOR ONE CLICK.
 *
 * ## Why the button is here rather than in a terminal
 *
 * `npm run mail:preview -- --send` renders all fourteen and cannot send one,
 * because `RESEND_API_KEY` is a **sensitive** variable on Vercel and those are
 * write-only: nobody reads one back, so no laptop holds the key. The deployed
 * product does. That makes this page the only place the send can happen, and
 * a console is a better home for it anyway — the person who needs to check a
 * subject line after changing it is not always the person with a checkout.
 *
 * ## What it is protecting against
 *
 * Transactional email rots quietly. Every fault in it — a stale link, a
 * footer that names the wrong sender, a layout that broke in Outlook — is
 * invisible until somebody makes the thing happen that sends it. This costs a
 * click, so it gets done.
 *
 * The send itself is in `app/(admin)/admin/actions.ts`, owner-only and
 * audited; the fourteen messages are `lib/mail-previews.ts`, invented people
 * only, and the address is the one typed into this field.
 */
export function MailCheck() {
  const [state, run] = useActionState(
    async (_prev: AdminActionState, form: FormData): Promise<AdminActionState> =>
      sendEveryTemplate(String(form.get("to") ?? "")),
    {},
  );

  return (
    <Card className="p-5">
      <div className="flex items-start gap-2.5">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">Check the emails</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            Sends all fourteen to one address, with invented people in them. Nothing
            reads a real record.
          </p>
        </div>
      </div>

      <form action={run} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Field label="Send them to" htmlFor="mail-check-to">
            <Input id="mail-check-to" name="to" type="email" required placeholder="you@example.com" />
          </Field>
        </div>
        <Send />
      </form>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="mt-3 text-sm text-teal-700">
          On their way.
        </p>
      ) : null}
    </Card>
  );
}

function Send() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="shrink-0">
      {pending ? "Sending…" : "Send all fourteen"}
    </Button>
  );
}
