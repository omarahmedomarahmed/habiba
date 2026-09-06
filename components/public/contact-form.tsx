"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { submitContact, type ContactState } from "@/app/(public)/contact/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { TICKET_TOPICS } from "@/lib/db/schema";

const INITIAL: ContactState = {};

/**
 * Write to a human. PLAN.md 18R.2, 18R.4, 18R.8.
 *
 * ## One handle, either kind
 *
 * §3b's rule, on a public form: an email address **or** a phone number, and
 * the form says so rather than marking one required and quietly excluding
 * everybody in the market this product is for. The country is asked for beside
 * the number because expanding a national number without one is guessing
 * (11R.5).
 *
 * ## 🔴 The warning is above the box, not under the button
 *
 * 18R.4. Somebody about to type "I don't think I can keep going" into a
 * contact form needs to be told *before* they type it that this is not the
 * fast route — and told where the fast route is. A disclaimer under the submit
 * button is a disclaimer read after the fact.
 *
 * ## The topics are a list
 *
 * 20.18. A free-text subject line cannot be triaged or counted, and the queue
 * this lands in is worked by three people at any hour.
 */

const TOPIC_LABELS: Record<string, string> = {
  account: "My account or signing in",
  billing: "A payment or a bill",
  my_record: "My record — claiming it, or what is in it",
  a_session: "Something about a session I had",
  a_therapist: "A therapist on the platform",
  joining_as_a_therapist: "Joining as a therapist",
  something_else: "Something else",
};

function Send({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} full>
      {pending ? "Sending…" : label}
    </Button>
  );
}

export function ContactForm({
  countries,
  heading,
  body,
}: {
  /** From `country_settings`, so the list is the one the product supports. */
  countries: { code: string; name: string }[];
  heading?: string;
  body?: string;
}) {
  const [state, action] = useActionState(submitContact, INITIAL);

  if (state.ok) {
    return (
      <Card className="border-teal-200 bg-teal-50 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-teal-900">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          We have it.
        </p>
        {/*
          18R.8 — what happens next and when. A form that says only "thanks" is
          a form nobody trusts they have used, and the reference is short on
          purpose: it is meant to be read out loud.
        */}
        <p className="mt-2 text-sm leading-relaxed text-teal-900/90">
          Your reference is <strong className="font-mono">{state.ok.reference}</strong>. A named
          person picks this up and answers within {state.ok.hours} hours — by email or by message,
          whichever you left us. If it is urgent, do not wait for us: use the radar.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      {heading ? <h2 className="text-lg font-bold text-slate-900">{heading}</h2> : null}
      {body ? <p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p> : null}

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
        <p className="text-sm leading-relaxed text-rose-900">
          <strong>Do not send anything urgent here.</strong> This reaches a person during working
          hours, not in the next ten minutes. If you need somebody now, open the{" "}
          <a href="/radar" className="font-semibold underline">
            radar
          </a>{" "}
          — clinicians are online this minute and you need no account. If you are in immediate
          danger, call your local emergency number.
        </p>
      </div>

      <form action={action} className="mt-4 space-y-3">
        {/* 18R.5 — the honeypot. Hidden from people, not from bots. */}
        <div aria-hidden className="hidden">
          <label htmlFor="website">Leave this empty</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        <Field label="What should we call you?" htmlFor="name">
          <Input id="name" name="name" required autoComplete="name" />
        </Field>

        <Field
          label="How should we reply?"
          hint="An email address or a phone number — whichever you actually read. One is enough."
        >
          <div className="space-y-2">
            <Input name="email" type="email" placeholder="you@example.com" autoComplete="email" />
            <div className="flex gap-2">
              <select
                name="country"
                aria-label="Country for the phone number"
                defaultValue=""
                className="h-12 w-32 rounded-xl border border-slate-200 bg-white px-2 text-sm"
              >
                <option value="">Country</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
              <Input
                name="phone"
                type="tel"
                placeholder="Phone number"
                autoComplete="tel"
                className="flex-1"
              />
            </div>
          </div>
        </Field>

        <Field label="What is this about?" htmlFor="topic">
          <select
            id="topic"
            name="topic"
            required
            defaultValue="something_else"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            {TICKET_TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {TOPIC_LABELS[topic] ?? topic}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Who are you writing to?" htmlFor="entity" hint="Both reach the same team.">
          <select
            id="entity"
            name="entity"
            defaultValue="us"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="us">24Therapy Inc. — international</option>
            <option value="eg">24Therapy Egypt — Egypt</option>
          </select>
        </Field>

        <Field label="Your message" htmlFor="message">
          <Textarea id="message" name="message" rows={6} required minLength={10} />
        </Field>

        {state.error ? (
          <p role="alert" className="text-sm text-rose-600">
            {state.error}
          </p>
        ) : null}

        <Send label="Send" />

        <p className="text-xs leading-relaxed text-slate-500">
          What you write is kept like anything else you tell a clinician here: stored, access
          controlled, read only by the person answering you, and never used to train anything.
        </p>
      </form>
    </Card>
  );
}
