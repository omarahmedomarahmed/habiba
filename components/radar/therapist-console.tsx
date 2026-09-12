"use client";

import { useActionState, useState, useSyncExternalStore, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { BellRing, Radio, Volume2, VolumeX } from "lucide-react";

import {
  saveAlertPreferences,
  saveRadarSetup,
  toggleRadar,
  type RadarState,
} from "@/app/(app)/on-call/actions";
import { WorldRadar } from "@/components/radar/world-radar";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import {
  alarmServerSnapshot,
  alarmSnapshot,
  armAlarmAndAlerts,
  playTone,
  subscribeAlarm,
  type AlarmState,
} from "@/lib/alarm";
import { formatUsd } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

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
  sessionRateCents: number;
  chargesEnabled: boolean;
  /**
   * 🔴 50.3 — the country they practise in has been closed to new bookings.
   *
   * Resolved on the server, where the taxonomy lives, and passed in as a
   * finished fact rather than as a code to look up: this component would
   * otherwise need a second async read to answer a question the page already
   * knows the answer to.
   */
  countryClosed: boolean;
  /* 🔴 37L.2 — code and label, never one string doing both jobs. */
  languageOptions: { code: string; label: string }[];
  specialtyOptions: { code: string; label: string }[];
  countryOptions: { code: string; name: string }[];
  alertOnView: boolean;
  alertOnBooking: boolean;
};

function Save() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("common.saving") : t("trad.saveProfile")}
    </Button>
  );
}

export function TherapistConsole(props: ConsoleProps) {
  const router = useRouter();
  const t = useT();
  const [formState, formAction] = useActionState(saveRadarSetup, INITIAL);
  const [status, setStatus] = useState(props.status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const online = status !== "offline";

  const sound = useSyncExternalStore(subscribeAlarm, alarmSnapshot, alarmServerSnapshot);
  const [asking, setAsking] = useState(false);

  /*
   * The poll, the heartbeat and the booking alarm are NOT here. They live in
   * <RadarPresence>, mounted once in the app shell, because a clinician who
   * navigates to their dashboard must stay on the radar and must still hear the
   * alarm. Duplicating them here would mean two heartbeats and two overlapping
   * beeps whenever this page happened to be the one open.
   */
  const flip = (next: boolean) =>
    startTransition(async () => {
      setError(null);
      const result = await toggleRadar(next);
      if (result.error) {
        setError(result.error);
        return;
      }
      setStatus(next ? "online" : "offline");
      // Re-render the shell so presence starts or stops with the switch.
      router.refresh();
    });

  /**
   * Going on call and being able to hear are the same decision.
   *
   * The button says "a stranger in crisis can be in a room with you inside a
   * minute". If the browser is muted that sentence is false, and it fails in
   * the worst direction: the clinician is advertised as reachable, the patient
   * pays, and nobody comes. So the switch asks first — once — and the answer
   * is proved by a sound they hear rather than by a claim we make.
   *
   * Going offline never asks. Nothing depends on hearing anything.
   */
  const requestOnline = () => {
    if (online || sound === "ready") {
      flip(!online);
      return;
    }
    setAsking(true);
  };

  /*
   * A rate is charged whether or not Stripe has finished with them.
   *
   * This used to compute a `ready` flag and, when it was false, quietly show
   * the clinician's own rate as "Free" — so somebody who had set forty dollars
   * went on the radar advertising nothing, and only found out afterwards. The
   * payment now goes through either way; if their account is not ready to
   * receive it, the platform holds their share and releases it on verification.
   *
   * What is left is a disclosure, not a block.
   */
  const held = props.sessionRateCents > 0 && !props.chargesEnabled;

  return (
    <div className="space-y-4">
      {/*
        The switch, on the radar itself.
        --------------------------------
        Going on call is the single most consequential button a clinician
        presses in this product — from here a stranger in distress can be in a
        room with them inside a minute. It gets the whole scope, live, with
        their own position on it, rather than a checkbox in a settings list.
      */}
      <div className="relative isolate overflow-hidden rounded-3xl bg-navy-600">
        <div className="absolute inset-0" aria-hidden>
          <WorldRadar
            dots={
              online && props.country
                ? [
                    {
                      id: "me",
                      country: props.country,
                      // `online` above already excludes "offline"; narrowing it
                      // again here keeps the dot type honest.
                      status: status,
                      label: t("trad.you"),
                    },
                  ]
                : []
            }
            className={cn("h-full w-full", online ? "opacity-90" : "opacity-30 grayscale")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-600 via-navy-600/70 to-navy-600/20" />
        </div>

        <div className="relative px-5 pt-24 pb-5 sm:pt-32">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
              online
                ? "border-teal-400/40 bg-teal-400/15 text-teal-300"
                : "border-white/15 bg-white/5 text-white/60",
            )}
          >
            <Radio className={cn("h-3 w-3", online && "live-dot")} aria-hidden />
            {status === "offline"
              ? t("trad.off")
              : status === "online"
                ? t("trad.on")
                : status === "pending"
                  ? t("trad.pending")
                  : t("trad.inSession")}
          </span>

          <p className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {online ? t("trad.headlineOn") : t("trad.headlineOff")}
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">
            {online ? t("trad.bodyOn") : t("trad.bodyOff")}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs text-white/50">{t("trad.rate")}</dt>
              <dd className="mt-0.5 text-xl font-bold text-white">
                {props.sessionRateCents > 0 ? formatUsd(props.sessionRateCents) : t("trad.free")}
              </dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs text-white/50">{t("trad.youKeep")}</dt>
              <dd className="mt-0.5 text-xl font-bold text-teal-300">
                {props.sessionRateCents > 0
                  ? formatUsd(props.sessionRateCents - Math.floor((props.sessionRateCents * 1000) / 10_000))
                  : "-"}
              </dd>
            </div>
          </dl>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-500/15 px-3.5 py-2.5 text-sm text-red-200"
            >
              {error}
            </p>
          ) : null}

          {held ? (
            <p className="mt-4 rounded-xl bg-amber-400/15 px-3.5 py-2.5 text-sm leading-relaxed text-amber-200">
              {t("trad.heldNote")}
            </p>
          ) : null}

          {/*
            🔴 50.3 — off the radar, and told why.

            Above the Go online button rather than below it, because the
            question this answers is the one somebody has while reaching for
            that button. Taking a clinician off the board silently is the same
            defect as a switch that does nothing: they press it, nothing
            happens, and they conclude the product is broken.
          */}
          {props.countryClosed ? (
            <div className="mt-4 rounded-xl bg-amber-400/15 px-3.5 py-2.5 text-amber-200">
              <p className="text-sm font-semibold">{t("trad.countryClosedTitle")}</p>
              <p className="mt-1 text-sm leading-relaxed">
                {t("trad.countryClosed", {
                  country: props.countryOptions.find((c) => c.code === props.country)?.name
                    ?? props.country
                    ?? "",
                })}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            disabled={pending}
            onClick={requestOnline}
            className={cn(
              "mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold transition-colors disabled:opacity-50",
              online
                ? "border border-white/20 text-white hover:bg-white/10"
                : "bg-teal-500 text-white shadow-lg shadow-teal-500/25 hover:bg-teal-400",
            )}
          >
            <Radio className="h-4 w-4" aria-hidden />
            {pending ? t("common.working") : online ? t("trad.goOffline") : t("trad.goOnline")}
          </button>

          {online && sound !== "ready" ? (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-red-300">
              <VolumeX className="h-3.5 w-3.5" aria-hidden />
              {t("trad.silentWarning")}
            </p>
          ) : null}

          {!props.country ? (
            <p className="mt-2 text-center text-xs text-white/40">
              {t("trad.addCountry")}
            </p>
          ) : null}
        </div>
      </div>

      {asking ? (
        <GoOnlineSound
          onCancel={() => setAsking(false)}
          onArmed={(armed) => {
            setAsking(false);
            // On the radar either way. A clinician who cannot get sound out of
            // this machine still has the banner, the tab title and the email —
            // refusing to let them work would be us punishing them for their
            // browser.
            void armed;
            flip(true);
          }}
        />
      ) : null}

      {/* ---------------------------------------------------------- alerts */}
      <AlertSettings
        initialOnView={props.alertOnView}
        initialOnBooking={props.alertOnBooking}
        sound={sound}
      />

      {/* --------------------------------------------------------- profile */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">{t("trad.profile")}</p>
        <p className="mt-0.5 text-sm text-slate-500">
          {t("trad.profileBody")}
        </p>

        <form action={formAction} className="mt-4 space-y-4">
          {formState.ok ? <p className="text-sm text-emerald-700">{t("common.saved")}</p> : null}
          {formState.error ? <p className="text-sm text-red-600">{formState.error}</p> : null}

          <Field
            label={t("trad.headline")}
            htmlFor="headline"
            hint={t("trad.headlineHint")}
          >
            <Textarea
              id="headline"
              name="headline"
              rows={2}
              maxLength={240}
              defaultValue={props.headline ?? ""}
              placeholder={t("trad.headlinePlaceholder")}
            />
          </Field>

          <Field label={t("trad.photo")} htmlFor="photoUrl" hint={t("trad.photoHint")}>
            <Input
              id="photoUrl"
              name="photoUrl"
              type="url"
              inputMode="url"
              defaultValue={props.photoUrl ?? ""}
              placeholder="https://…"
            />
          </Field>

          <Field label={t("trad.where")} htmlFor="country" hint={t("trad.whereHint")}>
            <select
              id="country"
              name="country"
              defaultValue={props.country ?? ""}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none"
            >
              <option value="">{t("trad.notShared")}</option>
              {props.countryOptions.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </Field>

          <CheckGroup
            legend={t("tver.languages")}
            name="languages"
            options={props.languageOptions}
            selected={props.languages}
          />

          <CheckGroup
            legend={t("tver.specialties")}
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
  options: { code: string; label: string }[];
  selected: string[];
}) {
  const chosen = new Set(selected);
  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-medium text-slate-700">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.code}
            className="cursor-pointer rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:text-brand-700"
          >
            <input
              type="checkbox"
              name={name}
              value={option.code}
              defaultChecked={chosen.has(option.code)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Which radar events make a noise.
 *
 * Two switches rather than one, because they are different events. Someone
 * opening your profile is a heads-up that you have gone busy to everyone else;
 * someone paying means a patient is walking into your room in the next thirty
 * seconds. A clinician who finds the first twitchy needs to be able to silence
 * it *without* silencing the second, or they will silence both and miss the one
 * that mattered.
 */
/**
 * The question asked at the moment it means something.
 *
 * Not on page load, where every permission prompt gets dismissed by reflex,
 * and not buried in settings, where nobody goes. Here, between "I want to take
 * crisis calls" and actually being on the board — the one instant where "may
 * we make a noise when one arrives" has an obvious answer.
 *
 * The button's click is itself the gesture the browser requires, which is the
 * entire reason this is a modal and not a `useEffect`.
 */
function GoOnlineSound({
  onCancel,
  onArmed,
}: {
  onCancel: () => void;
  onArmed: (armed: boolean) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center">
      <div className="animate-fade-rise w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50">
          <BellRing className="h-5 w-5 text-teal-600" aria-hidden />
        </span>

        <p className="mt-3 text-lg font-bold tracking-tight text-slate-900">
          {t("trad.canWeRing")}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          {t("trad.canWeRingBody")}
        </p>

        {failed ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-800">
            {t("trad.soundRefused")
              .split("{sound}")
              .flatMap((part, index) =>
                index === 0
                  ? [part]
                  : [<strong key="sound">{t("trad.soundWord")}</strong>, part],
              )}
          </p>
        ) : null}

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const result = await armAlarmAndAlerts();
            setBusy(false);
            if (result.sound === "ready") {
              playTone("ring");
              onArmed(true);
              return;
            }
            setFailed(true);
          }}
          className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-teal-500 text-base font-semibold text-white shadow-lg shadow-teal-500/25 hover:bg-teal-400 disabled:opacity-50"
        >
          <Volume2 className="h-4 w-4" aria-hidden />
          {busy ? t("trad.turningOn") : t("trad.turnOnAndGoLive")}
        </button>

        <button
          type="button"
          onClick={() => (failed ? onArmed(false) : onCancel())}
          className="mt-2 flex h-11 w-full items-center justify-center rounded-2xl text-sm font-medium text-slate-500 hover:bg-slate-50"
        >
          {failed ? t("trad.goWithoutSound") : t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

function AlertSettings({
  initialOnView,
  initialOnBooking,
  sound,
}: {
  initialOnView: boolean;
  initialOnBooking: boolean;
  sound: AlarmState;
}) {
  const router = useRouter();
  const t = useT();
  const [onView, setOnView] = useState(initialOnView);
  const [onBooking, setOnBooking] = useState(initialOnBooking);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const save = (next: { alertOnView: boolean; alertOnBooking: boolean }) =>
    startTransition(async () => {
      setSaved(false);
      await saveAlertPreferences(next);
      setSaved(true);
      router.refresh();
    });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <BellRing className="h-4 w-4 text-teal-600" aria-hidden />
          {t("trad.alertSounds")}
        </p>
        {pending ? (
          <span className="text-xs text-slate-400">{t("common.saving")}</span>
        ) : saved ? (
          <span className="text-xs text-emerald-600">{t("common.saved")}</span>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        <AlertToggle
          checked={onView}
          onChange={(value) => {
            setOnView(value);
            save({ alertOnView: value, alertOnBooking: onBooking });
          }}
          title={t("trad.alertViewTitle")}
          body={t("trad.alertViewBody")}
        />
        <AlertToggle
          checked={onBooking}
          onChange={(value) => {
            setOnBooking(value);
            save({ alertOnView: onView, alertOnBooking: value });
          }}
          title={t("trad.alertBookTitle")}
          body={t("trad.alertBookBody")}
        />
      </div>

      {/*
        Prove it, do not promise it.
        ----------------------------
        This card used to end with a paragraph explaining that the browser
        would probably play something once you had clicked around a bit. It
        was true and it was useless: there was no way to find out whether the
        alarm worked except to have a patient arrive and not hear them. A
        button that plays the actual sound answers the question in one tap.
      */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {sound === "ready" ? (
          <>
            <button
              type="button"
              onClick={() => playTone("ring")}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Volume2 className="h-3.5 w-3.5 text-teal-600" aria-hidden />
              {t("trad.hearBooking")}
            </button>
            <button
              type="button"
              onClick={() => playTone("urgent")}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              <BellRing className="h-3.5 w-3.5" aria-hidden />
              {t("trad.hearWaiting")}
            </button>
            <span className="text-xs font-medium text-emerald-600">{t("trad.soundOn")}</span>
          </>
        ) : (
          <button
            type="button"
            onClick={async () => {
              const result = await armAlarmAndAlerts();
              if (result.sound === "ready") playTone("ring");
            }}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-teal-500 px-3.5 text-xs font-semibold text-white hover:bg-teal-400"
          >
            <Volume2 className="h-3.5 w-3.5" aria-hidden />
            {t("trad.turnOn")}
          </button>
        )}
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
        {t("trad.soundsNote")}
      </p>
    </Card>
  );
}

function AlertToggle({
  checked,
  onChange,
  title,
  body,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  body: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border p-3",
        checked ? "border-teal-300 bg-teal-50/50" : "border-slate-200",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{body}</span>
      </span>
    </label>
  );
}
