"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";

import {
  checkJoinState,
  resumeAfterPayment as resumeAction,
  submitJoin,
  type JoinState,
} from "@/app/join/[token]/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";

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
      <Card className="p-6 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-brand-500" aria-hidden />
        <p className="mt-3 text-base font-semibold text-slate-900">You are in the waiting room</p>
        <p className="mt-1.5 text-sm text-slate-600">
          {live
            ? "Your therapist has started the session."
            : "This page will update by itself when your therapist starts."}
        </p>
      </Card>
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
