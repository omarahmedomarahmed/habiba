"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { BellRing, Radio, Volume2, VolumeX } from "lucide-react";

import { radarPing, saveRadarSetup, toggleRadar, type RadarState } from "@/app/(app)/on-call/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

const INITIAL: RadarState = {};

/** Slow enough not to be chatty, fast enough that the alarm is not late. */
const PING_MS = 8_000;

export type ConsoleProps = {
  status: "offline" | "online" | "pending" | "in_session";
  headline: string | null;
  photoUrl: string | null;
  languages: string[];
  specialties: string[];
  country: string | null;
  rateCents: number;
  chargesEnabled: boolean;
  languageOptions: readonly string[];
  specialtyOptions: readonly string[];
  countryOptions: { code: string; name: string }[];
};

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save radar profile"}
    </Button>
  );
}

export function TherapistConsole(props: ConsoleProps) {
  const router = useRouter();
  const [formState, formAction] = useActionState(saveRadarSetup, INITIAL);
  const [status, setStatus] = useState(props.status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<{ sessionId: string; paid: boolean } | null>(null);
  const [muted, setMuted] = useState(false);

  const audioRef = useRef<AudioContext | null>(null);
  const alarmRef = useRef<number | null>(null);
  const announcedRef = useRef<string | null>(null);

  const online = status !== "offline";

  /**
   * The alarm.
   *
   * A synthesised two-tone beep rather than an audio file: no asset to load, no
   * request to make, and it cannot fail to arrive at the one moment it matters.
   * The AudioContext is created inside the click that turns the radar on, which
   * is the user gesture browsers require before anything is allowed to make
   * noise — build it on the poll instead and it is silently suspended.
   */
  const beep = useCallback(() => {
    const context = audioRef.current;
    if (!context || muted) return;
    void context.resume();

    const now = context.currentTime;
    for (const [offset, frequency] of [
      [0, 880],
      [0.22, 1174],
      [0.44, 880],
    ] as const) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.32, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.19);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.2);
    }
  }, [muted]);

  const stopAlarm = useCallback(() => {
    if (alarmRef.current !== null) {
      clearInterval(alarmRef.current);
      alarmRef.current = null;
    }
  }, []);

  // Poll while online. This is both the heartbeat that keeps the clinician on
  // the public radar and the thing that notices an incoming booking.
  useEffect(() => {
    if (!online) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const result = await radarPing();
        if (cancelled) return;
        setBooking(result.booking);
        if (result.booking) setStatus(result.booking.paid ? "in_session" : "pending");
      } catch {
        // A dropped ping is not worth telling anyone about; the next one is
        // eight seconds away, and the sweep will take them offline if the tab
        // is genuinely gone.
      }
    };

    void tick();
    const timer = setInterval(tick, PING_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [online]);

  // Ring until acknowledged. A single beep is missable, and someone is waiting.
  useEffect(() => {
    if (!booking) {
      announcedRef.current = null;
      stopAlarm();
      return;
    }
    if (announcedRef.current === booking.sessionId) return;

    announcedRef.current = booking.sessionId;
    beep();
    stopAlarm();
    alarmRef.current = window.setInterval(beep, 3_000);

    return stopAlarm;
  }, [booking, beep, stopAlarm]);

  useEffect(() => stopAlarm, [stopAlarm]);

  const flip = (next: boolean) =>
    startTransition(async () => {
      setError(null);

      if (next && !audioRef.current) {
        // Inside the gesture, so the context starts unsuspended.
        const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctor) audioRef.current = new Ctor();
      }

      const result = await toggleRadar(next);
      if (result.error) {
        setError(result.error);
        return;
      }
      setStatus(next ? "online" : "offline");
      if (!next) {
        setBooking(null);
        stopAlarm();
      }
    });

  const ready = props.rateCents > 0 ? props.chargesEnabled : true;

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------- the switch */}
      <Card className={cn("p-5", online && "border-teal-300 bg-teal-50/40")}>
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              online ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-400",
            )}
          >
            <Radio className={cn("h-4 w-4", online && "live-dot")} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              {status === "offline"
                ? "You are off the radar"
                : status === "online"
                  ? "You are on the radar"
                  : status === "pending"
                    ? "Someone is booking you"
                    : "You are in a session"}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              {online
                ? "Anyone on the public radar can see you and start a session with you right now."
                : "Go online when you have a free half hour. You come off the radar the moment you close this tab."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? "Unmute the booking alarm" : "Mute the booking alarm"}
            className="tap-target flex items-center justify-center text-slate-400 hover:text-slate-700"
          >
            {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
          </button>
        </div>

        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {!ready ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            Finish Stripe onboarding in Settings before charging. Until then you can still go on the
            radar, but sessions will be free.
          </p>
        ) : null}

        <Button
          full
          size="lg"
          variant={online ? "secondary" : "teal"}
          className="mt-4"
          disabled={pending}
          onClick={() => flip(!online)}
        >
          {pending ? "Working…" : online ? "Go offline" : "Go on the radar"}
        </Button>

        <p className="mt-2 text-center text-xs text-slate-500">
          {props.rateCents > 0 && props.chargesEnabled
            ? `${formatUsd(props.rateCents)} for 30 minutes, paid before the patient can enter.`
            : "No rate set — radar sessions will be free. Set one in Settings."}
        </p>
      </Card>

      {/* ------------------------------------------------- incoming booking */}
      {booking ? (
        <div className="animate-fade-rise rounded-3xl bg-navy-500 px-5 py-4 text-white">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <BellRing className="live-dot h-4 w-4" aria-hidden />
            {booking.paid ? "Your patient has paid and is joining" : "Someone is booking you"}
          </p>
          <p className="mt-1 text-sm text-white/70">
            {booking.paid
              ? "They are on their way into the room. Open it now."
              : "They are paying. The room is ready — open it and be there when they arrive."}
          </p>
          <button
            type="button"
            onClick={() => {
              stopAlarm();
              router.push(`/sessions/${booking.sessionId}/room`);
            }}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-teal-500 text-sm font-semibold text-white"
          >
            Open the room
          </button>
        </div>
      ) : null}

      {/* --------------------------------------------------------- profile */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Your radar profile</p>
        <p className="mt-0.5 text-sm text-slate-500">
          This is what a stranger sees before they choose you. Nothing here is clinical and none of
          it is private.
        </p>

        <form action={formAction} className="mt-4 space-y-4">
          {formState.ok ? <p className="text-sm text-emerald-700">Saved</p> : null}
          {formState.error ? <p className="text-sm text-red-600">{formState.error}</p> : null}

          <Field
            label="One line about how you work"
            htmlFor="headline"
            hint="Shown under your name. Keep it human."
          >
            <Textarea
              id="headline"
              name="headline"
              rows={2}
              maxLength={240}
              defaultValue={props.headline ?? ""}
              placeholder="Twelve years with anxiety and panic. Direct, warm, no homework unless you want it."
            />
          </Field>

          <Field label="Photo URL" htmlFor="photoUrl" hint="Optional. Must be an https:// image.">
            <Input
              id="photoUrl"
              name="photoUrl"
              type="url"
              inputMode="url"
              defaultValue={props.photoUrl ?? ""}
              placeholder="https://…"
            />
          </Field>

          <Field label="Where you are based" htmlFor="country" hint="Country only — never your address.">
            <select
              id="country"
              name="country"
              defaultValue={props.country ?? ""}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none"
            >
              <option value="">Not shared</option>
              {props.countryOptions.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </Field>

          <CheckGroup
            legend="Languages you can work in"
            name="languages"
            options={props.languageOptions}
            selected={props.languages}
          />

          <CheckGroup
            legend="What you work with"
            name="specialties"
            options={props.specialtyOptions}
            selected={props.specialties}
          />

          <Save />
        </form>
      </Card>
    </div>
  );
}

function CheckGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: readonly string[];
  selected: string[];
}) {
  const chosen = new Set(selected);
  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-medium text-slate-700">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option}
            className="cursor-pointer rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:text-brand-700"
          >
            <input
              type="checkbox"
              name={name}
              value={option}
              defaultChecked={chosen.has(option)}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
