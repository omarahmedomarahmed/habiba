"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  Clock,
  Headphones,
  Lock,
  Mail,
  MessageSquareHeart,
  Phone,
  Star,
} from "lucide-react";

import { rateOnArrival } from "@/app/join/[token]/actions";
import { ConsentControls } from "@/components/join/consent-controls";
import { reportSession } from "@/app/feedback/[token]/actions";
import { Button, Card, Input, Textarea } from "@/components/ui";
import type { ClockStage } from "@/lib/session-clock";
import { cn, initials } from "@/lib/utils";

export type Therapist = {
  name: string;
  firstName: string;
  credentials: string | null;
  languages: string[];
};

/**
 * The patient's session room.
 *
 * It used to be a full-bleed iframe and nothing else — the video filled the
 * screen and the page had no idea who was in it, whether anything was being
 * recorded, or what would happen afterwards. That is defensible for a product
 * where both people already know each other. It is wrong here: this patient
 * chose a stranger off a map ninety seconds ago, is being recorded, and has
 * been promised a summary they have not yet given us an address for.
 *
 * So the call keeps the room it deserves — the largest thing on the screen,
 * always — and everything the patient needs to *know* sits beside it on a
 * desktop and beneath it on a phone, where it can be scrolled to without ever
 * covering a face.
 */
export function PatientRoom({
  token,
  therapist,
  videoUrl,
  live,
  recording,
  consent,
  startedAt,
  clock,
}: {
  token: string;
  therapist: Therapist;
  videoUrl: string | null;
  live: boolean;
  recording: boolean;
  consent: {
    recording: "granted" | "declined" | null;
    profileShare: "granted" | "declined" | null;
  };
  startedAt: string | null;
  clock: { stage: ClockStage; remainingSeconds: number } | null;
}) {
  /*
   * Escapes the join page's centred column.
   *
   * That column is right for a name form and wrong for a video call — the
   * first attempt at this rendered inside it and squeezed the call into a
   * sliver beside the panel. `fixed inset-0` takes the whole viewport and
   * scrolls internally, so the room owns the screen without the page around it
   * having to know that a session is in progress.
   */
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950">
      <div className="mx-auto grid max-w-6xl items-start gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_22rem] lg:p-4">
        {/* -------------------------------------------------------- the call */}
        <div className="min-w-0">
          <div className="overflow-hidden rounded-2xl bg-black">
            <RecordingStrip live={live} recording={recording} />

            {videoUrl ? (
              <iframe
                src={videoUrl}
                title="Your session"
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                className="aspect-[3/4] w-full border-0 sm:aspect-video lg:aspect-[4/3]"
              />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 px-6 text-center">
                <Headphones className="h-6 w-6 text-white/30" aria-hidden />
                <p className="text-sm font-semibold text-white">
                  {live ? "Your session has started" : "Waiting for your therapist"}
                </p>
                <p className="max-w-xs text-xs leading-relaxed text-white/50">
                  {live
                    ? "This is an audio session — you will hear each other."
                    : "This page updates by itself the moment they join. Keep it open."}
                </p>
              </div>
            )}
          </div>

          <p className="mt-2 px-1 text-center text-[11px] text-white/40 lg:text-start">
            Trouble seeing or hearing? Check your browser has permission to use your camera and
            microphone, then reload this page — you will come straight back in.
          </p>
        </div>

        {/* ------------------------------------------------------- the panel */}
        <aside className="space-y-3">
          {/*
            Loudest thing in the panel, and first.
            --------------------------------------
            It used to sit fourth, in the same 12px grey as everything else,
            and it is the only line here that has a cost attached to being
            missed: a patient who closes the tab loses their rating and their
            written summary in the same click, and there is no way to get
            either back to them. Everything else on this panel is information.
            This is an instruction.
          */}
          <StayHere therapist={therapist} />
          {/*
            7.8 — above the reassurance and below the instruction. These are
            the only two things on this panel the patient can *change*, and a
            control buried under four paragraphs of explanation is a control
            that gets found after the session rather than during it.
          */}
          <ConsentControls
            token={token}
            recording={consent.recording}
            profileShare={consent.profileShare}
          />
          {live && clock ? <PatientClockNote clock={clock} /> : null}
          <WhoYouAreWith therapist={therapist} live={live} startedAt={startedAt} />
          <SummaryAndRating token={token} live={live} therapist={therapist} />
          <Reassurance />
          <TroubleBox token={token} />
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ recording -- */

/**
 * Red while the microphone runs, amber when it stops.
 *
 * Directly above the video, at all times, because the person whose words are
 * being recorded is the last one who should have to ask — and until this
 * existed they were the only participant who could not tell.
 */
function RecordingStrip({ live, recording }: { live: boolean; recording: boolean }) {
  if (!live) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-[12px] font-medium",
        recording ? "bg-red-950/60 text-red-100" : "bg-amber-950/60 text-amber-100",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          recording ? "live-dot bg-red-500" : "bg-amber-400",
        )}
      />
      {recording ? "Recording — for your therapist's notes" : "Recording paused by your therapist"}
    </div>
  );
}

/* --------------------------------------------------------------- clock -- */

/**
 * The patient's half of the countdown — and it is now literally the same one.
 *
 * Deliberately not a permanent timer. The elapsed-minutes line below stays what
 * it was, orientation rather than pressure, and this appears only for the last
 * stretch, when there is something the patient would want to have known in
 * advance.
 *
 * The important change is that both screens now show the *same* number from the
 * same function. Before, the clinician was answering a prompt about whether to
 * continue and the patient was told their therapist was "deciding" — which is a
 * strange thing to read while you are still talking. Neither side is deciding
 * anything now: the session ends when it ends, and carrying on means a new one.
 */
function PatientClockNote({
  clock,
}: {
  clock: { stage: ClockStage; remainingSeconds: number };
}) {
  if (clock.stage === "running") return null;

  if (clock.stage === "over") {
    return (
      <Card className="border-amber-200 bg-amber-50/70 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
          This session has ended
        </p>
        <p className="mt-1 text-sm leading-relaxed text-amber-800">
          If you and your therapist want to carry on, they can send you a link to a new session.
        </p>
      </Card>
    );
  }

  const minutes = Math.max(1, Math.round(clock.remainingSeconds / 60));

  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm text-slate-700">
        <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span>
          About{" "}
          <span className="font-semibold text-slate-900">
            {minutes} minute{minutes === 1 ? "" : "s"}
          </span>{" "}
          left in this session. Your therapist sees the same countdown.
        </span>
      </p>
    </Card>
  );
}

/* ----------------------------------------------------------- who and how -- */

function WhoYouAreWith({
  therapist,
  live,
  startedAt,
}: {
  therapist: Therapist;
  live: boolean;
  startedAt: string | null;
}) {
  const [elapsed, setElapsed] = useState("");

  /*
   * Minutes since the session started.
   *
   * Not a countdown. A clock ticking down toward zero in front of somebody
   * having a hard conversation is a pressure nobody needs; "you have been
   * talking for 12 minutes" is orientation, which is different.
   */
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      const minutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
      setElapsed(minutes < 1 ? "just started" : `${minutes} min so far`);
    };
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [startedAt]);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy-500 text-sm font-semibold text-white">
          {initials(therapist.firstName, therapist.name.split(" ")[1] ?? "")}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{therapist.name}</p>
          <p className="truncate text-xs text-slate-500">
            {therapist.credentials ?? "Licensed clinician"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {therapist.languages.length > 0 ? <span>Speaks {therapist.languages.join(", ")}</span> : null}
        {live && elapsed ? <span className="font-medium text-teal-700">{elapsed}</span> : null}
      </div>

      <p className="mt-3 flex items-start gap-1.5 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        Verified by 24Therapy — we checked their licence and their ID before they could take a
        session.
      </p>
    </Card>
  );
}

/* -------------------------------------------------- summary and the ask -- */

/**
 * The app rating, and the address to send the summary to.
 *
 * Only once the therapist has actually joined. Asking somebody to rate how
 * easy it was to find a therapist while they are still sitting in an empty
 * room waiting for one is asking them to rate a thing that has not finished
 * happening — and the answer we would collect is a measure of our own latency
 * dressed up as satisfaction.
 */
function SummaryAndRating({
  token,
  live,
  therapist,
}: {
  token: string;
  live: boolean;
  therapist: Therapist;
}) {
  const [stars, setStars] = useState(0);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!live) {
    return (
      <Card className="p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          A written summary, afterwards
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          When {therapist.firstName} joins we will ask where to send it — a plain-language note of
          what you talked about and what you agreed.
        </p>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="border-teal-200 bg-teal-50/60 p-4">
        <p className="text-sm font-semibold text-teal-900">Thank you</p>
        <p className="mt-1 text-xs leading-relaxed text-teal-800">
          Your summary will come to that address once {therapist.firstName} has written up the
          session.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">How easy was it to find someone?</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          Just about 24Therapy — not about {therapist.firstName}. You rate the session and your
          therapist afterwards.
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
        <label htmlFor="room-email" className="text-xs font-medium text-slate-800">
          Where shall we send your summary?
        </label>
        <Input
          id="room-email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1.5 h-11 text-sm"
          placeholder="you@example.com"
        />
      </div>

      <Button
        full
        size="sm"
        disabled={pending || stars === 0}
        onClick={() =>
          startTransition(async () => {
            await rateOnArrival(token, stars, email);
            setDone(true);
          })
        }
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </Card>
  );
}

/**
 * Do not close this tab.
 *
 * The single most costly thing a patient can do at the end of a session is
 * shut the browser, because the rating and the summary both live on the other
 * side of it. Saying so while they are still in the room is the only time it
 * will be read.
 */
function StayHere({ therapist }: { therapist: Therapist }) {
  return (
    <Card className="border-amber-300 bg-amber-50 p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-amber-700 uppercase">
        <MessageSquareHeart className="h-3.5 w-3.5" aria-hidden />
        Before you go
      </p>

      <p className="mt-1.5 text-2xl leading-[1.12] font-black tracking-tight text-slate-900">
        Do not close this tab.
      </p>

      <p className="mt-2 text-base leading-snug font-semibold text-slate-800">
        You get to rate {therapist.firstName} and this session as soon as it ends — right here, on
        this page.
      </p>

      <p className="mt-2.5 text-xs leading-relaxed text-slate-600">
        Closing the tab is the one thing we cannot undo: the rating and your written summary both
        live on the other side of it, and there is no way for us to bring you back.
      </p>

      <p className="mt-2 flex items-start gap-1.5 border-t border-amber-200 pt-2.5 text-xs leading-relaxed text-slate-600">
        <Star className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-hidden />
        <span>
          Your rating is <strong>anonymous</strong>. {therapist.firstName} sees the stars and the
          words, never who wrote them.
        </span>
      </p>
    </Card>
  );
}

function Reassurance() {
  return (
    <Card className="p-4">
      <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Good to know</p>
      <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-600">
        <li className="flex gap-2">
          <Lock className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
          The recording is used to write your therapist's notes. It is not shared with anyone else.
        </li>
        <li className="flex gap-2">
          <Mail className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
          You get a plain-language summary. Your therapist's clinical note stays with them.
        </li>
        <li className="flex gap-2">
          <Phone className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
          This is not an emergency service. If you are in immediate danger, call your local
          emergency number — in the US, call or text 988.
        </li>
      </ul>
    </Card>
  );
}

/**
 * A way to reach us from inside the room.
 *
 * Not after, and not through the therapist. If something is going wrong in a
 * session, the person it is going wrong with is the last person a patient
 * should have to ask for the complaints address.
 */
function TroubleBox({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Sent to 24Therapy</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Someone will read this today. It did not go to your therapist.
        </p>
      </Card>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-start text-xs font-medium text-white/70 hover:bg-slate-800"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
        Something is wrong — tell 24Therapy
      </button>
    );
  }

  return (
    <Card className="space-y-2.5 p-4">
      <p className="text-sm font-semibold text-slate-900">Tell us what is happening</p>
      <p className="text-xs leading-relaxed text-slate-500">
        This goes straight to 24Therapy. Your therapist does not see it.
      </p>
      <Textarea
        rows={3}
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        placeholder="What is happening right now."
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="danger"
          disabled={pending || detail.trim().length < 10}
          onClick={() =>
            startTransition(async () => {
              await reportSession({ token, kind: "abuse", detail, email: "" });
              setSent(true);
            })
          }
        >
          {pending ? "Sending…" : "Send"}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
