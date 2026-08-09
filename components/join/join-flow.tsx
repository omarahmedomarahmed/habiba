"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, ShieldCheck } from "lucide-react";

import { checkJoinState, submitJoin, type JoinState } from "@/app/join/[token]/actions";
import { Button, Card, Field, Input } from "@/components/ui";

const INITIAL: JoinState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="teal" full disabled={pending}>
      {pending ? "Joining…" : "Join session"}
    </Button>
  );
}

/**
 * The entire patient surface: type a first name, join.
 *
 * No account, no password, no download, no portal. The old product had a
 * 21-page patient application for this; the spec itself said patients should
 * not need accounts.
 */
export function JoinFlow({ token, modality }: { token: string; modality: "in_person" | "video" }) {
  const [state, action] = useActionState(submitJoin, INITIAL);
  const [live, setLive] = useState(false);
  const [ended, setEnded] = useState(false);

  // Poll while parked in the waiting room. Five seconds is plenty for "has my
  // therapist started yet", and it is the only polling on this page.
  useEffect(() => {
    if (!state.joined || live) return;
    const poll = setInterval(async () => {
      const result = await checkJoinState(token);
      if (result.ended) setEnded(true);
      if (result.live) setLive(true);
    }, 5000);
    return () => clearInterval(poll);
  }, [state.joined, live, token]);

  if (ended) {
    return (
      <Card className="p-6 text-center">
        <p className="text-base font-semibold text-slate-900">The session has ended</p>
        <p className="mt-1.5 text-sm text-slate-600">
          You can close this page. If your therapist is sending you a summary, it will arrive by
          email.
        </p>
      </Card>
    );
  }

  if (state.joined) {
    if (state.videoUrl) {
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
            src={state.videoUrl}
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
          No account needed. Just tell us what to call you.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <input type="hidden" name="token" value={token} />

      <Field label="Your first name" htmlFor="name">
        <Input id="name" name="name" autoComplete="given-name" autoCapitalize="words" required />
      </Field>

      <Submit />

      <p className="flex items-start gap-2 rounded-xl bg-slate-100 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {modality === "video"
          ? "Your session is private. Your therapist may record it to write their clinical notes — ask them if you have any questions about that."
          : "Your session is private. Your therapist may record it to write their clinical notes."}
      </p>
    </form>
  );
}
