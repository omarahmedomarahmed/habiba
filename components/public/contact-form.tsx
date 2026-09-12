"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import {
  submitContact,
  type ContactState,
} from "@/app/(public)/contact/actions";
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

/**
 * 🔴 21R.8 — every word of this form arrives from the server, in the reader's
 * language.
 *
 * It was English on the Arabic page, warning included. A form somebody cannot
 * read is a form they do not send, and the people most likely to need this one
 * are the least likely to read English. Props rather than a hook for C84's
 * reason: a client component that asks the runtime renders one language on the
 * server pass and another after hydration.
 */
export type ContactStrings = Record<string, string>;

function Send({ label, sending }: { label: string; sending: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} full>
      {pending ? sending : label}
    </Button>
  );
}

/** The server leaves `{reference}` and friends in place; the values live here. */
function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

export function ContactForm({
  countries,
  heading,
  body,
  strings,
}: {
  /** From `country_settings`, so the list is the one the product supports. */
  countries: { code: string; name: string }[];
  heading?: string;
  body?: string;
  strings: ContactStrings;
}) {
  const s = (key: string) => strings[key] ?? key;
  const [state, action] = useActionState(submitContact, INITIAL);

  if (state.ok) {
    return (
      <Card className="border-teal-200 bg-teal-50 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-teal-900">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {s("contact.received")}
        </p>
        {/*
          18R.8 — what happens next and when. A form that says only "thanks" is
          a form nobody trusts they have used, and the reference is short on
          purpose: it is meant to be read out loud.
        */}
        <p className="mt-2 text-sm leading-relaxed text-teal-900/90">
          {fill(s("contact.reference"), {
            reference: state.ok.reference,
            hours: state.ok.hours,
          })}
        </p>
        {state.ok.attachmentNote ? (
          <p className="mt-2 text-sm text-amber-800">
            {fill(s("contact.attachmentFailed"), {
              reason: state.ok.attachmentNote,
            })}
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="p-5">
      {heading ? (
        <h2 className="text-lg font-bold text-slate-900">{heading}</h2>
      ) : null}
      {body ? (
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p>
      ) : null}

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-rose-600"
          aria-hidden
        />
        {/*
          18R.4 — the warning is above the box, not under the button, and the
          radar is a link inside it rather than an afterthought: somebody who
          needs help now must be able to leave this form for the one place that
          answers in minutes.
        */}
        <p className="text-sm leading-relaxed text-rose-900">
          <strong>{s("contact.urgentLead")}</strong>{" "}
          {s("contact.urgentBody")
            .split(s("contact.radarWord"))
            .flatMap((part, index) =>
              index === 0
                ? [part]
                : [
                    <a
                      key={index}
                      href="/radar"
                      className="font-semibold underline"
                    >
                      {s("contact.radarWord")}
                    </a>,
                    part,
                  ],
            )}
        </p>
      </div>

      <form action={action} className="mt-4 space-y-3">
        {/* 18R.5 — the honeypot. Hidden from people, not from bots. */}
        <div aria-hidden className="hidden">
          <label htmlFor="website">Leave this empty</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        <Field label={s("contact.name")} htmlFor="name">
          <Input id="name" name="name" required autoComplete="name" />
        </Field>

        <Field label={s("contact.reply")} hint={s("contact.replyHint")}>
          <div className="space-y-2">
            <Input
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
            />
            <div className="flex gap-2">
              <select
                name="country"
                aria-label={s("contact.countryAria")}
                defaultValue=""
                className="h-12 w-32 rounded-xl border border-slate-200 bg-white px-2 text-sm"
              >
                <option value="">{s("contact.country")}</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
              <Input
                name="phone"
                type="tel"
                placeholder={s("contact.phone")}
                autoComplete="tel"
                className="flex-1"
              />
            </div>
          </div>
        </Field>

        <Field label={s("contact.topic")} htmlFor="topic">
          <select
            id="topic"
            name="topic"
            required
            defaultValue="something_else"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            {TICKET_TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {s(`contact.topic.${topic}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={s("contact.entity")}
          htmlFor="entity"
          hint={s("contact.entityHint")}
        >
          <select
            id="entity"
            name="entity"
            defaultValue="us"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="us">{s("contact.entityUs")}</option>
            <option value="eg">{s("contact.entityEg")}</option>
          </select>
        </Field>

        <Field label={s("contact.message")} htmlFor="message">
          <Textarea
            id="message"
            name="message"
            rows={6}
            required
            minLength={10}
          />
        </Field>

        {/*
          20.19 — one photo or PDF. Kept and access-controlled exactly like a
          clinical document, and never read by a model. A prescription
          photographed for a support agent is a medical record whichever door
          it came through.
        */}
        <Field
          label={s("contact.attach")}
          htmlFor="attachment"
          hint={s("contact.attachHint")}
        >
          <input
            id="attachment"
            name="attachment"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="w-full text-sm text-slate-600 file:me-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
          />
        </Field>

        {state.error ? (
          <p role="alert" className="text-sm text-rose-600">
            {state.error}
          </p>
        ) : null}

        <Send label={s("contact.send")} sending={s("contact.sending")} />

        <p className="text-xs leading-relaxed text-slate-500">
          {s("contact.kept")}
        </p>
      </form>
    </Card>
  );
}
