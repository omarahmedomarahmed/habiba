"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { CreditCard, Loader2, ShieldCheck, Star } from "lucide-react";

import {
  checkJoinState,
  rateOnArrival,
  resumeAfterPayment as resumeAction,
  submitJoin,
  type JoinState,
} from "@/app/join/[token]/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { RECORDING_CONSENT } from "@/lib/consent";
import { formatUsd } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { PatientRoom, type Therapist } from "@/components/join/patient-room";

const INITIAL: JoinState = {};

function Submit({ priceCents }: { priceCents: number }) {
  const { pending } = useFormStatus();
  const paid = priceCents > 0;
  return (
    <Button type="submit" size="lg" variant="teal" full disabled={pending}>
      {paid ? <CreditCard className="h-4 w-4" aria-hidden /> : null}
      {pending
        ? paid
          ? "Opening checkout…"
          : "Joining…"
        : paid
          ? `Pay ${formatUsd(priceCents)} and join`
          : "Join session"}
    </Button>
  );
}

/**
 * The entire patient surface: type a first name, pay if there is a price, join.
 *
 * No account, no password, no download, no portal. The old product had a
 * 21-page patient application for this; the spec itself said patients should
 * not need accounts.
 */
export function JoinFlow({
  therapist,
  token,
  modality,
  priceCents,
  paymentStatus,
  resumeAfterPayment,
  cancelled,
}: {
  therapist: Therapist;
  token: string;
  modality: "in_person" | "video";
  priceCents: number;
  paymentStatus: "not_required" | "pending" | "paid";
  resumeAfterPayment: boolean;
  cancelled: boolean;
}) {
  const [state, action] = useActionState(submitJoin, INITIAL);
  const [resumed, setResumed] = useState<JoinState | null>(null);
  const [live, setLive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const resuming = useRef(false);

  const current = resumed ?? state;
  const owes = priceCents > 0 && paymentStatus !== "paid";

  // Stripe's success_url is a full page load, so everything the client knew is
  // gone. The name was stored server-side before leaving, which is what makes
  // walking straight back into the room possible.
  useEffect(() => {
    if (!resumeAfterPayment || resuming.current) return;
    resuming.current = true;
    void resumeAction(token).then(setResumed);
  }, [resumeAfterPayment, token]);

  // A payment link is a redirect, not a fetch — the action returns the URL and
  // the browser leaves.
  useEffect(() => {
    if (state.payUrl) window.location.href = state.payUrl;
  }, [state.payUrl]);

  // Poll while parked in the waiting room. Five seconds is plenty for "has my
  // therapist started yet", and it is the only polling on this page.
  useEffect(() => {
    if (!current.joined || live) return;
    const poll = setInterval(async () => {
      const result = await checkJoinState(token);
      if (result.ended) setEnded(true);
      if (result.live) setLive(true);
      setRecording(result.recording);
      setStartedAt(result.startedAt);
    }, 5000);
    return () => clearInterval(poll);
  }, [current.joined, live, token]);

  /*
   * Keep polling once the session is live, not only while waiting.
   *
   * The old loop stopped the moment the therapist started, which is exactly
   * when the recording indicator starts mattering — the patient could no
   * longer be told that the microphone had been paused, or that the session
   * had ended.
   */
  useEffect(() => {
    if (!current.joined || !live) return;
    const poll = setInterval(async () => {
      const result = await checkJoinState(token);
      if (result.ended) setEnded(true);
      setRecording(result.recording);
      setStartedAt(result.startedAt);
    }, 5000);
    return () => clearInterval(poll);
  }, [current.joined, live, token]);

  if (ended) {
    /*
     * Straight on to the rating, because this is the only moment it will ever
     * be filled in. Somebody who closes this page and reads a "how did we do?"
     * email tomorrow is gone — and their summary is behind the form, so the
     * two things people want at this exact second are the same thing.
     */
    return (
      <Card className="p-6 text-center">
        <p className="text-base font-semibold text-slate-900">The session has ended</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-600">
          One minute of feedback and we will email you a plain-language summary of what you talked
          about and what you agreed.
        </p>
        <a
          href={`/feedback/${token}`}
          className="mt-4 inline-flex h-12 items-center justify-center rounded-2xl bg-teal-500 px-5 text-sm font-semibold text-white hover:bg-teal-600"
        >
          Rate the session and get my summary
        </a>
      </Card>
    );
  }

  if (resumeAfterPayment && !resumed) {
    return (
      <Card className="p-6 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-brand-500" aria-hidden />
        <p className="mt-3 text-base font-semibold text-slate-900">Payment received</p>
        <p className="mt-1.5 text-sm text-slate-600">Taking you into your session…</p>
      </Card>
    );
  }

  /*
   * One room, whether or not there is video.
   *
   * There used to be two completely different screens here — a full-bleed
   * iframe if a video URL existed, and a small "waiting room" card if it did
   * not — so everything a patient needs to know appeared, disappeared and
   * reappeared depending on a Daily.co configuration flag. It is one page now,
   * and the call is simply the largest thing on it.
   */
  if (current.joined) {
    return (
      <PatientRoom
        token={token}
        therapist={therapist}
        videoUrl={current.videoUrl ?? null}
        live={live}
        recording={recording}
        startedAt={startedAt}
      />
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Join your session</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          {owes
            ? "No account needed. Tell us what to call you, then pay to enter."
            : "No account needed. Just tell us what to call you."}
        </p>
      </div>

      {owes ? (
        <div className="flex items-baseline justify-between rounded-2xl bg-navy-500 px-4 py-3.5 text-white">
          <span className="text-sm text-white/70">This session</span>
          <span className="text-2xl font-bold tracking-tight">{formatUsd(priceCents)}</span>
        </div>
      ) : null}

      {cancelled ? (
        <p className="rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-600">
          Payment cancelled — nothing was charged. You can try again below.
        </p>
      ) : null}

      {current.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {current.error}
        </p>
      ) : null}

      <input type="hidden" name="token" value={token} />

      <Field label="Your first name" htmlFor="name">
        <Input id="name" name="name" autoComplete="given-name" autoCapitalize="words" required />
      </Field>

      {owes ? (
        <Field label="Email for your receipt" htmlFor="email" hint="Optional.">
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
          />
        </Field>
      ) : null}

      <ConsentStep />

      <Submit priceCents={owes ? priceCents : 0} />

      <p className="flex items-start gap-2 rounded-xl bg-slate-100 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {owes
          ? "Payment is handled by Stripe and goes to your therapist — we never see your card. Your session is private and is not shared with anyone else."
          : "Your session is private and is not shared with anyone else."}
      </p>
    </form>
  );
}

/**
 * Asking, rather than telling.
 *
 * The page used to carry a line of grey twelve-pixel text saying "your
 * therapist may record it to write their clinical notes", below the button,
 * next to the payment disclaimer. That is notice. It records nothing, it
 * proves nothing, and it is placed exactly where nobody reads it.
 *
 * Three deliberate choices here:
 *
 *   Nothing is pre-selected. A pre-ticked box is not an affirmative act, and
 *   a stored "granted" that came from a default is worse than no record at
 *   all — it is a document asserting a decision that never happened.
 *
 *   The consequence of refusing is stated before the choice, not after. A
 *   person who does not know whether saying no costs them their appointment
 *   is not choosing freely, they are guessing.
 *
 *   Both options look the same. Styling "yes" as the primary action and "no"
 *   as a grey escape hatch is a nudge, and a nudged consent is the kind that
 *   falls over the moment anybody examines it.
 */
function ConsentStep() {
  const [choice, setChoice] = useState<"granted" | "declined" | null>(null);

  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4">
      <legend className="px-1.5 text-sm font-semibold text-slate-900">
        {RECORDING_CONSENT.question}
      </legend>

      <ul className="mt-1 space-y-1.5">
        {RECORDING_CONSENT.points.map((point) => (
          <li key={point} className="flex gap-2 text-xs leading-relaxed text-slate-600">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
            {point}
          </li>
        ))}
      </ul>

      <p className="mt-2.5 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
        {RECORDING_CONSENT.refusal}
      </p>

      <div className="mt-3 grid gap-2">
        {(
          [
            ["granted", RECORDING_CONSENT.grant],
            ["declined", RECORDING_CONSENT.decline],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-medium transition-colors",
              choice === value
                ? "border-teal-500 bg-teal-50 text-teal-900"
                : "border-slate-200 text-slate-700 hover:bg-slate-50",
            )}
          >
            <input
              type="radio"
              name="consent"
              value={value}
              required
              checked={choice === value}
              onChange={() => setChoice(value)}
              className="h-4 w-4 border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
