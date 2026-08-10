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
import { formatUsd } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

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
  token,
  modality,
  priceCents,
  paymentStatus,
  resumeAfterPayment,
  cancelled,
}: {
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

  if (current.joined) {
    if (current.videoUrl) {
      /*
       * The call takes the whole screen.
       *
       * A patient in a therapy session is looking at their therapist's face,
       * not at our page chrome. Constraining that to a small card inside a
       * centred column — which is what the layout does for the name form —
       * makes the most important part of the experience the smallest thing on
       * the page.
       */
      return (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <RecordingBar live={live} recording={recording} />
          <iframe
            src={current.videoUrl}
            title="Your session"
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="min-h-0 w-full flex-1 border-0"
          />
          <p className="safe-bottom bg-black px-4 pt-2 text-center text-[11px] text-white/40">
            Trouble seeing or hearing? Check your browser has permission to use your camera and
            microphone.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Card className="p-6 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-brand-500" aria-hidden />
          <p className="mt-3 text-base font-semibold text-slate-900">You are in the waiting room</p>
          <p className="mt-1.5 text-sm text-slate-600">
            {live
              ? "Your therapist has started the session."
              : "This page will update by itself when your therapist starts."}
          </p>
        </Card>

        <RecordingCard live={live} recording={recording} />

        {/*
          Asked here because here is the only moment it is honest to ask.
          ---------------------------------------------------------------
          They are sitting doing nothing, and the question is about the only
          part of this they have experienced so far — finding somebody. Ask it
          afterwards and you get an answer about the therapy instead, which is
          a different question we ask separately and anonymously.
        */}
        <ArrivalRating token={token} />
      </div>
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

      <Submit priceCents={owes ? priceCents : 0} />

      <p className="flex items-start gap-2 rounded-xl bg-slate-100 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {owes
          ? "Payment is handled by Stripe and goes to your therapist — we never see your card. Your session is private, and your therapist may record it to write their clinical notes."
          : modality === "video"
            ? "Your session is private. Your therapist may record it to write their clinical notes — ask them if you have any questions about that."
            : "Your session is private. Your therapist may record it to write their clinical notes."}
      </p>
    </form>
  );
}

/**
 * Whether the microphone is running, on the patient's own screen.
 *
 * Red means recording, amber means paused. The person whose words are being
 * recorded is the last one who should have to ask, and until now they were the
 * only one who could not tell — the clinician pressed the button, so the
 * clinician knew, and the patient's screen said nothing either way.
 *
 * Over the video call it is a slim strip rather than a badge, because it has
 * to be legible without competing with a human face.
 */
function RecordingBar({ live, recording }: { live: boolean; recording: boolean }) {
  if (!live) return null;
  return (
    <div className="safe-top flex items-center justify-center gap-2 bg-black px-4 py-2 text-[12px] font-medium text-white/80">
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          recording ? "live-dot bg-red-500" : "bg-amber-400",
        )}
      />
      {recording ? "Recording" : "Recording paused by your therapist"}
    </div>
  );
}

function RecordingCard({ live, recording }: { live: boolean; recording: boolean }) {
  if (!live) return null;
  return (
    <Card className="flex items-center gap-2.5 px-4 py-3">
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          recording ? "live-dot bg-red-500" : "bg-amber-400",
        )}
      />
      <p className="text-sm text-slate-700">
        {recording ? (
          <>
            <span className="font-semibold text-slate-900">Recording.</span> The session is being
            transcribed so your therapist can write their notes.
          </>
        ) : (
          <>
            <span className="font-semibold text-slate-900">Recording paused.</span> Your therapist
            has stopped the recording for now.
          </>
        )}
      </p>
    </Card>
  );
}

/**
 * "How easy was it to find someone?"
 *
 * One question about *us*, answered before the session can colour it, plus the
 * address to send their summary to. The line about rating the therapist
 * afterwards is deliberately blunt: a patient asked to rate something on the
 * way in will assume that was their chance to say what they thought, and then
 * be surprised by a second form. Telling them plainly here is what makes the
 * second one feel expected rather than nagging — and anonymity is the part
 * that decides whether they answer it honestly, so it is said in the same
 * breath.
 */
function ArrivalRating({ token }: { token: string }) {
  const [stars, setStars] = useState(0);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Thank you</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          After the session you will be asked to rate the session and your therapist. That one is
          <strong> completely anonymous</strong> — they never see who wrote it — and it is what
          releases your written summary.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">While you wait — how did we do?</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          Just about 24Therapy: how easy was it to find someone just now?
        </p>
      </div>

      <div className="flex gap-1" role="radiogroup" aria-label="Rate 24Therapy">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={stars === value}
            aria-label={`${value} out of 5`}
            onClick={() => setStars(value)}
            className="tap-target flex items-center justify-center"
          >
            <Star
              className={cn(
                "h-7 w-7 transition-colors",
                value <= stars ? "fill-amber-400 text-amber-400" : "text-slate-200",
              )}
              aria-hidden
            />
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="arrival-email" className="text-sm font-medium text-slate-800">
          Where should we send your session summary?
        </label>
        <Input
          id="arrival-email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1.5"
          placeholder="you@example.com"
        />
      </div>

      <p className="rounded-xl bg-brand-50 px-3 py-2.5 text-xs leading-relaxed text-brand-900">
        <strong>After the session</strong> you will be asked to rate the session and your therapist.
        That rating is <strong>anonymous</strong> — your therapist sees the words, never who wrote
        them — and completing it is what sends you your written summary.
      </p>

      <Button
        full
        disabled={pending || stars === 0}
        onClick={() =>
          startTransition(async () => {
            await rateOnArrival(token, stars, email);
            setDone(true);
          })
        }
      >
        {pending ? "Saving…" : "Send"}
      </Button>
    </Card>
  );
}
