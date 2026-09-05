"use client";

import { useState, useTransition } from "react";
import { Check, Mic, UserCircle2 } from "lucide-react";

import { turnOnConsent } from "@/app/join/[token]/actions";

/**
 * The two controls, in the room, both changeable mid-session. §3 / PLAN.md 7.8.
 *
 * ## Why they are one-way
 *
 * §3: "Wants to turn it off — cannot. End the session; answer no next time."
 * A switch that appeared to turn recording off would be telling somebody their
 * words are no longer being kept while the minutes already captured sit in the
 * database. The honest control is one that only goes on, plus a sentence
 * saying what to do instead — which is what the footnote below is.
 *
 * So a granted control renders as a **statement**, not a disabled switch. A
 * greyed-out toggle invites people to try it and then feel refused; a line of
 * text that says "you agreed to this" does not.
 *
 * ## Why they are separate questions
 *
 * Recording is about this hour. Sharing a profile is about everything before
 * it. A patient may reasonably say yes to one and no to the other, and one
 * combined "consent" would make that impossible to say.
 */
export function ConsentControls({
  token,
  recording,
  profileShare,
}: {
  token: string;
  recording: "granted" | "declined" | null;
  profileShare: "granted" | "declined" | null;
}) {
  const [state, setState] = useState({ recording, profileShare });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const turnOn = (control: "recording" | "profileShare") =>
    startTransition(async () => {
      setError(null);
      const result = await turnOnConsent(token, control);
      if (result.error) setError(result.error);
      else setState((s) => ({ ...s, [control]: "granted" }));
    });

  return (
    <div className="rounded-2xl bg-white/5 p-3.5 ring-1 ring-white/10">
      <p className="text-sm font-semibold text-white">Your choices</p>
      <p className="mt-0.5 text-xs leading-relaxed text-white/50">
        You can change these at any time during the session.
      </p>

      <div className="mt-3 space-y-2.5">
        <Control
          icon={<Mic className="h-4 w-4" aria-hidden />}
          label="Record this session"
          detail="Your therapist's notes are written from the recording."
          granted={state.recording === "granted"}
          pending={pending}
          onTurnOn={() => turnOn("recording")}
        />
        <Control
          icon={<UserCircle2 className="h-4 w-4" aria-hidden />}
          label="Share my profile"
          detail="Lets this therapist see the history you have built up elsewhere."
          granted={state.profileShare === "granted"}
          pending={pending}
          onTurnOn={() => turnOn("profileShare")}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}

      {/*
        Said plainly, because the alternative is a person tapping a switch that
        does nothing and drawing their own conclusion about why.
      */}
      <p className="mt-3 text-[11px] leading-relaxed text-white/40">
        Changed your mind about recording? It cannot be switched off part-way — anything already
        recorded exists. Ask your therapist to end the session, and answer no next time.
      </p>
    </div>
  );
}

function Control({
  icon,
  label,
  detail,
  granted,
  pending,
  onTurnOn,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  granted: boolean;
  pending: boolean;
  onTurnOn: () => void;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={granted ? "mt-0.5 text-teal-300" : "mt-0.5 text-white/40"}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-white/50">{detail}</p>
      </div>
      {granted ? (
        <span className="mt-0.5 flex shrink-0 items-center gap-1 text-xs font-semibold text-teal-300">
          <Check className="h-3.5 w-3.5" aria-hidden />
          On
        </span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={onTurnOn}
          className="tap-target mt-0.5 h-8 shrink-0 rounded-lg bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-white/90 disabled:opacity-50"
        >
          {pending ? "…" : "Turn on"}
        </button>
      )}
    </div>
  );
}
