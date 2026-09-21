"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Mail } from "lucide-react";

import { sendEveryTemplate, type AdminActionState } from "@/app/(admin)/admin/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import type { PreviewRow } from "@/lib/mail-previews";

/**
 * 🔴 77.12 — LOOK AT EVERY EMAIL THIS PRODUCT SENDS, FOR ONE CLICK.
 *
 * ## Why the button is here rather than in a terminal
 *
 * `npm run mail:preview -- --send` renders every one and cannot send any,
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
 * audited; the messages are `lib/mail-previews.ts`, invented people only, and
 * the address is the one typed into this field.
 *
 * ## 🔴 78.4 — AND IT SAYS WHO EACH ONE IS FOR
 *
 * Fourteen messages arrived in one inbox and the question back was whether all
 * of them were the patient's. Twelve were. A list that does not name its
 * audiences reads as a complete survey of the product and is a complete survey
 * of one person in it, so the roster below groups by recipient and the count
 * beside each heading is the answer to that question.
 */
export function MailCheck({ roster }: { roster: PreviewRow[] }) {
  /*
   * 🔴 THE ACTION ITSELF, not a wrapper around it.
   *
   * An inline async function here would be a CLIENT function, so React could
   * not render the hidden fields that let the form submit without JavaScript,
   * and the button would be dead on a browser with scripting off. Passing the
   * server action straight through is what makes the form real.
   */
  const [state, run] = useActionState<AdminActionState, FormData>(sendEveryTemplate, {});

  return (
    <Card className="p-5">
      <div className="flex items-start gap-2.5">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">Check the emails</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            Sends all {roster.length} to one address, with invented people in them. Nothing
            reads a real record.
          </p>
        </div>
      </div>

      <Roster roster={roster} />

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
        <p role="status" className="mt-3 text-sm text-brand-700">
          On their way.
        </p>
      ) : null}
    </Card>
  );
}

/**
 * Every message, under the heading of whoever receives it.
 *
 * The order of the headings is fixed rather than taken from the data, so an
 * audience with nothing in it shows as an empty group instead of vanishing.
 * A missing recipient type that disappears from the page is the exact failure
 * this section exists to prevent.
 */
const AUDIENCES = ["patient", "clinician", "company", "partner", "our staff"] as const;

function Roster({ roster }: { roster: PreviewRow[] }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {AUDIENCES.map((audience) => {
        const mine = roster.filter((row) => row.audience === audience);
        return (
          <div key={audience} className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
              {audience} · {mine.length}
            </p>
            <ul className="mt-2 space-y-1.5">
              {mine.length === 0 ? (
                <li className="text-sm text-rose-600">nothing, which is a gap</li>
              ) : (
                mine.map((row) => (
                  <li key={row.name} className="text-sm leading-snug text-slate-800">
                    <span className="font-semibold">{row.name}</span>
                    <span className="block text-slate-700">{row.when}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function Send() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="shrink-0">
      {pending ? "Sending…" : "Send them all"}
    </Button>
  );
}
