"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";

import { raiseTicket, type TherapistSupportState } from "@/app/(app)/support/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

const INITIAL: TherapistSupportState = {};

/**
 * A clinician's ticket. PLAN.md 20.23, 20.25.
 *
 * The topics are the clinician's, not the patient's — billing, payouts, a
 * session that went wrong, verification, the app itself — because a list that
 * does not fit the person filling it in becomes "something else" for
 * everything, and then the queue cannot sort.
 */
/* 37L.2 — keys. The short forms below are what the ticket list shows, which
   used to be the raw enum with its underscores turned into spaces. */
const TOPICS: { value: string; label: MessageKey; short: MessageKey }[] = [
  { value: "billing", label: "tsup.topicBilling", short: "tsup.topicBillingShort" },
  { value: "a_session", label: "tsup.topicSession", short: "tsup.topicSessionShort" },
  { value: "account", label: "tsup.topicAccount", short: "tsup.topicAccountShort" },
  { value: "something_else", label: "tsup.topicOther", short: "tsup.topicOther" },
];

function Send() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" full disabled={pending}>
      {pending ? t("tsup.sending") : t("tsup.send")}
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
            {t("tsup.reference", { ref: state.ok.reference })}
          </p>
          <p className="mt-1 text-sm text-teal-900/90">
            {t("tsup.picksUp", { hours: state.ok.hours })}
          </p>
        </Card>
      ) : null}

      <Card className="p-5">
        <form action={action} className="space-y-3">
          <Field label={t("tsup.about")} htmlFor="topic">
            <select
              id="topic"
              name="topic"
              required
              defaultValue="billing"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              {TOPICS.map((topic) => (
                <option key={topic.value} value={topic.value}>
                  {t(topic.label)}
                </option>
              ))}
            </select>
          </Field>

          {/* 20.25 — attach what it is about, so staff are not guessing. */}
          <Field
            label={t("tsup.aboutPayout")}
            htmlFor="payoutRequestId"
            hint={t("tsup.optionalRoundTrip")}
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

          <Field label={t("tsup.aboutSession")} htmlFor="sessionId" hint={t("tsup.optional")}>
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

          <Field label={t("tsup.whatHappened")} htmlFor="message">
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
                <span className="text-slate-700">
                  {t(TOPICS.find((x) => x.value === row.topic)?.short ?? "tsup.topicOther")}
                </span>
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
