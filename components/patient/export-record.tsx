"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";

import { exportMyRecord, type ExportState } from "@/app/(patient)/patient/record/actions";
import { Button, Card } from "@/components/ui";

/**
 * "Send me everything." PLAN.md 26.9, 26.10, C128.
 *
 * ## 🔴 The button says what it needs BEFORE it is pressed
 *
 * C128's ruling, and it is a small thing that matters a lot: a person with no
 * email on file must not press "send me my record", wait, and then be told it
 * cannot be done. So when there is no address the button itself says so and
 * goes to the place that fixes it. Most patients here have no email (§3b), so
 * this is the common path rather than the edge case.
 */
export function ExportRecord({ email }: { email: string | null }) {
  const [state, setState] = useState<ExportState>({});
  const [pending, start] = useTransition();

  if (!email) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">A copy of everything</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          We send a record extract to an email address and nowhere else. Not WhatsApp: it is the
          most personal document we hold about you, and a message on a shared phone is not where
          it belongs.
        </p>
        <Link
          href="/patient/account"
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white"
        >
          <Mail className="h-4 w-4" aria-hidden />
          Add an email to get your record
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-slate-900">A copy of everything</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        Every session, every note your therapists signed, every version of your summary, what you
        wrote yourself, and the dates. We email a link to <strong>{email}</strong> and nowhere
        else. It opens without a password and stops working after three days.
      </p>

      {state.sentTo ? (
        <div className="mt-4 rounded-xl bg-teal-50 px-3.5 py-3">
          <p className="text-sm leading-relaxed text-teal-900">
            On its way to {state.sentTo}. Nobody here read it.
          </p>
          {state.code ? (
            <p className="mt-1.5 text-xs leading-relaxed text-teal-900/80">
              The cover page carries the code {state.code}. Anybody you hand the document to can
              check that code and confirm we produced it.
            </p>
          ) : null}
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <Button
        className="mt-4"
        full
        disabled={pending || Boolean(state.sentTo)}
        onClick={() => start(async () => setState(await exportMyRecord()))}
      >
        {pending ? "Putting it together…" : state.sentTo ? "Sent" : "Email me my record"}
      </Button>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        It is a record extract, not a certificate. It says what we hold and when it was written. It
        does not say that a diagnosis in it is right, and nothing in it is written for a court.
      </p>
    </Card>
  );
}
