"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";

import { raiseTicket, type TherapistSupportState } from "@/app/(app)/support/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

const INITIAL: TherapistSupportState = {};

/**
 * A clinician's ticket. PLAN.md 20.23, 20.25.
 *
 * The topics are the clinician's, not the patient's — billing, payouts, a
 * session that went wrong, verification, the app itself — because a list that
 * does not fit the person filling it in becomes "something else" for
 * everything, and then the queue cannot sort.
 */
const TOPICS: { value: string; label: string }[] = [
  { value: "billing", label: "Billing, bundles, invoices, what I was charged" },
  { value: "a_session", label: "A session that went wrong" },
  { value: "account", label: "Verification or my account" },
  { value: "something_else", label: "Something else" },
];

function Send() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" full disabled={pending}>
      {pending ? "Sending…" : "Send"}
    </Button>
  );
}

export function TherapistSupport({
  sessions,
  payouts,
  mine,
}: {
  sessions: { id: string; label: string }[];
  payouts: { id: string; label: string }[];
  mine: { reference: string; topic: string; status: string; atLabel: string }[];
}) {
  const t = useT();
  const [state, action] = useActionState(raiseTicket, INITIAL);

  return (
    <div className="space-y-4">
      {state.ok ? (
        <Card className="border-teal-200 bg-teal-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-teal-900">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Reference {state.ok.reference}
          </p>
          <p className="mt-1 text-sm text-teal-900/90">
            A named person picks this up and answers within {state.ok.hours} hours. When it is
            closed you get a link to read the reply. We do not put it in an email.
          </p>
        </Card>
      ) : null}

      <Card className="p-5">
        <form action={action} className="space-y-3">
          <Field label="What is this about?" htmlFor="topic">
            <select
              id="topic"
              name="topic"
              required
              defaultValue="billing"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              {TOPICS.map((topic) => (
                <option key={topic.value} value={topic.value}>
                  {topic.label}
                </option>
              ))}
            </select>
          </Field>

          {/* 20.25 — attach what it is about, so staff are not guessing. */}
          <Field
            label="A payout it is about"
            htmlFor="payoutRequestId"
            hint="Optional. Saves us both a round trip."
          >
            <select
              id="payoutRequestId"
              name="payoutRequestId"
              defaultValue=""
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">{t("tsup.notPayout")}</option>
              {payouts.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="A session it is about" htmlFor="sessionId" hint="Optional.">
            <select
              id="sessionId"
              name="sessionId"
              defaultValue=""
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">{t("tsup.notSession")}</option>
              {sessions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="What happened?" htmlFor="message">
            <Textarea id="message" name="message" rows={6} required minLength={10} />
          </Field>

          {state.error ? (
            <p role="alert" className="text-sm text-rose-600">
              {state.error}
            </p>
          ) : null}
          <Send />
        </form>
      </Card>

      {mine.length > 0 ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-900">{t("tsup.yourTickets")}</p>
          <ul className="mt-2 divide-y divide-slate-100">
            {mine.map((row) => (
              <li key={row.reference} className="flex items-center gap-3 py-2 text-sm">
                <span className="font-mono text-xs text-slate-400">{row.reference}</span>
                <span className="text-slate-700">{row.topic.replace(/_/g, " ")}</span>
                <span className="ms-auto text-xs text-slate-500">
                  {row.status} · {row.atLabel}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
