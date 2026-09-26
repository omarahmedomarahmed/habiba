"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Clock,
  Headphones,
  Lock,
  Mail,
  Maximize2,
  MessageSquareHeart,
  Minimize2,
  Phone,
  Star,
} from "lucide-react";

import { rateOnArrival, reportFromRoom, setSessionMinimised, stopRecording } from "@/app/join/[token]/actions";
import { ConsentControls } from "@/components/join/consent-controls";
import { Button, Input, Textarea } from "@/components/ui";
import { Card } from "@/components/patient/kit";
import type { ClockStage } from "@/lib/session-clock";
import { cn, initials } from "@/lib/utils";
import { useLocale, useT } from "@/lib/i18n/client";
import { rich, slot } from "@/lib/i18n/rich";
import { listSeparator } from "@/lib/i18n/config";

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
  recovery = null,
}: {
  /**
   * 🔴 W2-P11: somebody else, or their money back, when the clinician has not
   * come. It lived below the join flow, under this room's full-screen layer,
   * so a patient waiting inside the room never saw it.
   */
  recovery?: React.ReactNode;
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
  const t = useT();

  /*
   * 🔴 76.35 — THE ROOM SHRINKS TO AN ORB, AND THE CALL DOES NOT STOP.
   *
   * ## The rule the whole thing is built around
   *
   * **The iframe is never unmounted and never `display: none`.** Both of those
   * are how a browser decides a media element is not being used, and both would
   * end the call the moment somebody minimised it, which is the exact opposite
   * of what this control is for. The element below keeps the same position in
   * the tree in both states so React reuses it rather than remounting it, and
   * the minimised state is a smaller BOX around the same iframe rather than a
   * different branch that renders one.
   *
   * That is also what makes the audio survive a tab switch and a phone app
   * switch. A backgrounded tab keeps a live WebRTC connection running; it does
   * not keep a connection that a re-render tore down while the tab was hidden.
   *
   * ## Why a patient wants this at all
   *
   * They are on a phone, in the middle of a session they may have waited a week
   * for, and something arrives: a message to read, a number to look up, a call
   * to decline. Without this the only two options are to stare at it or to
   * leave the call, and leaving the call in the middle of a therapy session is
   * a thing people do not come back from.
   */
  const [minimised, setMinimised] = useState(false);

  /*
   * 🔴 THE TIMER IS OURS AND STARTS WHEN THE SESSION DOES.
   *
   * Not when they minimised: a patient looking at an orb wants to know how far
   * into their hour they are, which is the same question the panel answers when
   * the room is open. `startedAt` is the server's, so a browser clock that is
   * wrong is wrong about the offset rather than about the start.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!minimised || !startedAt) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [minimised, startedAt]);

  const elapsed = startedAt
    ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
    : 0;

  /*
   * 🔴 TELL THE CLINICIAN, AND NEVER WAIT FOR THE ANSWER.
   *
   * A patient tapping minimise is already reaching for another app. A spinner
   * on the way out is the worst possible moment for one, and if the write is
   * lost the clinician sees a patient who appears present, which is what they
   * saw before this existed.
   */
  const told = useRef<boolean | null>(null);
  useEffect(() => {
    if (!live) return;
    if (told.current === minimised) return;
    told.current = minimised;
    void setSessionMinimised(token, minimised).catch(() => undefined);
  }, [minimised, live, token]);

  /*
   * Escapes the join page's centred column.
   *
   * That column is right for a name form and wrong for a video call — the
   * first attempt at this rendered inside it and squeezed the call into a
   * sliver beside the panel. `fixed inset-0` takes the whole viewport and
   * scrolls internally, so the room owns the screen without the page around it
   * having to know that a session is in progress.
   */
  /*
   * 🔴 76.35 — ONE IFRAME, DECLARED ONCE, IN BOTH STATES.
   *
   * This is the whole trick and it is worth being explicit about. React reuses
   * a DOM node when the element keeps its type and position; it tears one down
   * and builds another when the shape of the tree around it changes. An iframe
   * that is torn down is a call that ends.
   *
   * So the iframe is ONE variable, rendered into whichever shell is on screen,
   * and both shells are always in the tree. The minimised one is a 96 pixel
   * circle with the call playing inside it at its own size; the open one is the
   * room. Nothing is `display: none` and nothing is conditionally mounted,
   * which is what lets a patient switch apps, take a call and come back to a
   * session that never stopped.
   */
  const call = videoUrl ? (
    <iframe
      src={videoUrl}
      title={t("room.yourSession")}
      allow="camera; microphone; fullscreen; display-capture; autoplay"
      className="h-full w-full border-0"
    />
  ) : (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute h-72 w-72 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(46,196,182,0.45), rgba(46,196,182,0) 70%)" }}
      />
      <span className="relative mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
        <Headphones className="h-8 w-8 text-brand-300" aria-hidden />
      </span>
      <p className="relative text-[18px] font-bold text-white">
        {live ? t("room.started") : t("room.waiting")}
      </p>
      <p className="relative max-w-xs text-[13px] leading-relaxed text-white/65">
        {live ? t("room.audioOnly") : t("room.keepOpen")}
      </p>
    </div>
  );

  if (minimised) {
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return (
      /*
       * 🔴 THE ORB, AND WHERE IT SITS IS A RULE RATHER THAN A STYLE.
       *
       * `z-[65]`, which is above the payment orb at 60 and BELOW the SOS orb.
       * C235: the patient's crisis path never depends on money and never
       * depends on anything else either, so nothing this product draws may
       * cover that button. A session orb over it would be C235 broken by a
       * stacking context, which is exactly how the payment orb's own placement
       * was decided.
       */
      <div className="fixed end-3 bottom-40 z-[65] flex flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={() => setMinimised(false)}
          aria-label={t("room.reopen")}
          className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-white/70 bg-black shadow-2xl"
        >
          {/*
            The call itself, playing, at 96 pixels. Not a placeholder and not a
            paused frame: a patient who can SEE their therapist still there is
            the difference between a minimised session and one they believe has
            dropped.
          */}
          <span className="pointer-events-none absolute inset-0 block">{call}</span>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-[11px] font-bold text-white tabular-nums">
            {mins}:{String(secs).padStart(2, "0")}
          </span>
          {recording ? (
            <span className="live-dot pointer-events-none absolute end-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500" />
          ) : null}
          <span className="pointer-events-none absolute start-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white/85 text-navy-700">
            <Maximize2 className="h-3 w-3" aria-hidden />
          </span>
        </button>
        <span className="rounded-full bg-navy-900/85 px-2 py-0.5 text-[11px] font-semibold text-white">
          {t("room.stillOn")}
        </span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy-900">
      <div className="mx-auto grid max-w-6xl items-start gap-4 p-3 pt-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:p-4 lg:pt-14">
        {/* -------------------------------------------------------- the call */}
        <div className="min-w-0">
          <div className="overflow-hidden rounded-[28px] bg-gradient-to-b from-navy-700 to-navy-800 ring-1 ring-white/10">
            <RecordingStrip live={live} recording={recording} token={token} />

            <div className="aspect-[3/4] w-full sm:aspect-video lg:aspect-[4/3]">{call}</div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-[12px] text-white/60">{t("room.trouble")}</p>
            {/*
              🔴 76.35 — MINIMISE, AND ONLY WHILE THERE IS SOMETHING TO MINIMISE.
              A control that shrinks a room nobody is in yet would be a way to
              miss the start of your own session.
            */}
            {live ? (
              <button
                type="button"
                onClick={() => setMinimised(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-4 text-[13px] font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                <Minimize2 className="h-3 w-3" aria-hidden />
                {t("room.minimise")}
              </button>
            ) : null}
          </div>
        </div>

        {/* ------------------------------------------------------- the panel */}
        <aside className="space-y-3">
          {/* 🔴 W2-P11: first, because it is the only thing here that changes what happens next. */}
          {!live ? recovery : null}
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
function RecordingStrip({
  live,
  recording,
  token,
}: {
  live: boolean;
  recording: boolean;
  /** 48.10 — present means this patient can stop it themselves. */
  token: string | null;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [stopped, setStopped] = useState(false);

  if (!live) return null;

  const running = recording && !stopped;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 text-[12px] font-medium",
        running ? "bg-red-950/60 text-red-100" : "bg-amber-950/60 text-amber-100",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          running ? "live-dot bg-red-500" : "bg-amber-400",
        )}
      />
      {/*
        🔴 The stopped wording no longer says "by your therapist".
        48.10 gave the patient the same button, so a person who has just
        stopped their own recording and is told their therapist did it would
        reasonably conclude the control did nothing.
      */}
      {running ? t("proom.recording") : t("proom.recordingStopped")}

      {/*
        🔴 48.10 — the patient's own control, beside the thing it controls.

        Not in a settings screen and not behind a menu: the moment somebody
        wants this is mid-sentence, and a control they have to go looking for
        is one they will ask the other person in the room to press instead.
      */}
      {running && token ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await stopRecording(token);
              if (result.ok) setStopped(true);
            })
          }
          className="tap-target rounded-full bg-white/15 px-2.5 py-0.5 font-semibold underline-offset-2 hover:bg-white/25 disabled:opacity-50"
        >
          {t("troom.offRecordPatient")}
        </button>
      ) : null}

      {stopped ? (
        <span className="w-full text-center text-[11px] font-normal opacity-80">
          {t("troom.offRecordPatientWhy")}
        </span>
      ) : null}
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
  const t = useT();
  if (clock.stage === "running") return null;

  if (clock.stage === "over") {
    return (
      <Card className="border-amber-200 bg-amber-50/70 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
          {t("room.endedTitle")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-amber-800">
          {t("room.endedAgain")}
        </p>
      </Card>
    );
  }

  const minutes = Math.max(1, Math.round(clock.remainingSeconds / 60));

  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm text-navy-600">
        <Clock className="h-4 w-4 shrink-0 text-navy-400" aria-hidden />
        <span>
          {rich(t("room.minutesLeft", { minutes: slot(0) }), [
            <span key="m" className="font-semibold text-navy-700">
              {minutes === 1 ? t("room.oneMinute") : t("room.manyMinutes", { count: minutes })}
            </span>,
          ])}
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
  const t = useT();
  // 47.7 — the list separator is the reader's, not a hardcoded one.
  const locale = useLocale();
  const [minutes, setMinutes] = useState<number | null>(null);

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
      setMinutes(Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
    };
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [startedAt]);

  /* B67: worded at render, in the reader's language like the rest of the room. */
  const elapsed =
    minutes === null ? "" : minutes < 1 ? t("room.justStarted") : t("room.minSoFar", { count: minutes });

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy-500 text-sm font-semibold text-white">
          {initials(therapist.firstName, therapist.name.split(" ")[1] ?? "")}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy-700">{therapist.name}</p>
          <p className="truncate text-xs text-navy-400">
            {therapist.credentials ?? t("room.licensed")}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-navy-400">
        {therapist.languages.length > 0 ? <span>{t("room.speaks", { languages: therapist.languages.join(listSeparator(locale)) })}</span> : null}
        {live && elapsed ? <span className="font-medium text-brand-700">{elapsed}</span> : null}
      </div>

      <p className="mt-3 flex items-start gap-1.5 border-t border-navy-100 pt-3 text-[11px] leading-relaxed text-navy-400">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        {t("room.verifiedBody")}
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
  const t = useT();
  const [stars, setStars] = useState(0);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!live) {
    return (
      <Card className="p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-700">
          <Mail className="h-3.5 w-3.5 text-navy-400" aria-hidden />
          {t("room.summaryTitle")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-navy-400">
          {t("room.summaryWhen", { name: therapist.firstName })}
        </p>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="border-brand-200 bg-brand-50/60 p-4">
        <p className="text-sm font-semibold text-brand-900">{t("room.thanks")}</p>
        <p className="mt-1 text-xs leading-relaxed text-brand-800">
          {t("room.summaryComing", { name: therapist.firstName })}
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 p-4">
      <div>
        <p className="text-sm font-semibold text-navy-700">{t("room.howEasy")}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-navy-400">
          {t("room.appOnly", { name: therapist.firstName })}
        </p>
      </div>

      <div className="flex gap-1" role="radiogroup" aria-label={t("room.rateApp")}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={stars === value}
            aria-label={t("radar.starsOf", { stars: value })}
            onClick={() => setStars(value)}
            className="tap-target flex items-center justify-center"
          >
            <Star
              className={cn(
                "h-7 w-7 transition-colors",
                value <= stars ? "fill-amber-400 text-amber-400" : "text-navy-100",
              )}
              aria-hidden
            />
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="room-email" className="text-xs font-medium text-navy-700">
          {t("room.whereSummary")}
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
          placeholder={t("room.emailPlaceholder")}
        />
      </div>

      {failed ? (
        <p role="alert" className="text-xs leading-relaxed text-red-700">
          {t("room.ratingFailed")}
        </p>
      ) : null}

      <Button
        full
        size="sm"
        disabled={pending || stars === 0}
        onClick={() =>
          startTransition(async () => {
            /*
             * 🔴 K9: thanks only for a rating that was kept. The room used to
             * say thank you whatever came back, including a refusal.
             */
            const result = await rateOnArrival(token, stars, email).catch(() => ({ ok: false }));
            if (result.ok) {
              setFailed(false);
              setDone(true);
            } else {
              setFailed(true);
            }
          })
        }
      >
        {pending ? t("common.saving") : t("common.save")}
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
  const t = useT();
  return (
    <Card className="border-amber-300 bg-amber-50 p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-amber-700 uppercase">
        <MessageSquareHeart className="h-3.5 w-3.5" aria-hidden />
        {t("room.beforeYouGo")}
      </p>

      <p className="mt-1.5 text-2xl leading-[1.12] font-black tracking-tight text-navy-700">
        {t("room.doNotClose")}
      </p>

      <p className="mt-2 text-base leading-snug font-semibold text-navy-700">
        {t("room.rateAfter", { name: therapist.firstName })}
      </p>

      <p className="mt-2.5 text-xs leading-relaxed text-navy-400">
        {t("room.closingCost")}
      </p>

      <p className="mt-2 flex items-start gap-1.5 border-t border-amber-200 pt-2.5 text-xs leading-relaxed text-navy-400">
        <Star className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-hidden />
        <span>
          {t("room.anonymous", { therapist: therapist.firstName })}
        </span>
      </p>
    </Card>
  );
}

function Reassurance() {
  const t = useT();
  return (
    <Card className="p-4">
      <p className="text-xs font-bold tracking-wider text-navy-400 uppercase">{t("room.goodToKnow")}</p>
      <ul className="mt-2 space-y-2 text-xs leading-relaxed text-navy-400">
        <li className="flex gap-2">
          <Lock className="mt-0.5 h-3 w-3 shrink-0 text-navy-400" aria-hidden />
          {t("room.knowRecording")}
        </li>
        <li className="flex gap-2">
          <Mail className="mt-0.5 h-3 w-3 shrink-0 text-navy-400" aria-hidden />
          {t("room.knowSummary")}
        </li>
        {/*
          🔴 C184 / C198 — THE SHARED LINE, NOT A SECOND COPY OF IT.

          `room.knowEmergency` said almost exactly what `crisis.notEmergency` says, three
          words apart, on the screen a patient sits on during a session. Two copies of a
          safety sentence is the defect that put an American lifeline in front of an
          Egyptian patient: the fix lands on one of them and nobody knows the other is
          there. There is one line now, and it is the one `lib/crisis` owns.
        */}
        <li className="flex gap-2">
          <Phone className="mt-0.5 h-3 w-3 shrink-0 text-navy-400" aria-hidden />
          {t("crisis.notEmergency")}
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
  const t = useT();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState("");
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <Card className="p-4">
        <p className="text-sm font-semibold text-navy-700">{t("room.sentToUs")}</p>
        <p className="mt-1 text-xs leading-relaxed text-navy-400">
          {t("room.sentToUsBody")}
        </p>
      </Card>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-2xl border border-navy-600 bg-navy-900 px-4 py-3 text-start text-xs font-medium text-white/70 hover:bg-navy-800"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
        {t("room.troubleTitle")}
      </button>
    );
  }

  return (
    <Card className="space-y-2.5 p-4">
      <p className="text-sm font-semibold text-navy-700">{t("room.tellUsTitle")}</p>
      <p className="text-xs leading-relaxed text-navy-400">
        {t("room.tellUsBody")}
      </p>
      <Textarea
        rows={3}
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        placeholder={t("room.tellUsPlaceholder")}
      />
      {failed ? (
        <p role="alert" className="text-xs text-red-700">
          {t("room.notSent")}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="danger"
          disabled={pending || detail.trim().length < 10}
          onClick={() =>
            startTransition(async () => {
              /*
               * 🔴 W1-11: "Sent" only when it was. This used to ignore the
               * result and say "Sent to 24Therapy" over a refusal.
               */
              const result = await reportFromRoom({ token, detail }).catch(() => ({
                ok: false,
              }));
              setFailed(!result.ok);
              if (result.ok) setSent(true);
            })
          }
        >
          {pending ? "Sending…" : "Send"}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>
      </div>
    </Card>
  );
}
