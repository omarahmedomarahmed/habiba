"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";

import { saveRadarSetup, toggleRadar, type RadarState } from "@/app/(app)/on-call/actions";
import { WorldRadar } from "@/components/radar/world-radar";
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

  const online = status !== "offline";

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

  const ready = props.rateCents > 0 ? props.chargesEnabled : true;

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
                      label: "You",
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
              ? "Off the radar"
              : status === "online"
                ? "Live on the radar"
                : status === "pending"
                  ? "Someone is booking you"
                  : "In a session"}
          </span>

          <p className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {online ? "You are visible to the world" : "Fill a free half hour"}
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">
            {online
              ? "Anyone on the public radar can see you and start a session with you right now. The alarm will reach you anywhere in the app."
              : "Go on call between appointments. Someone who needs help now finds you, pays you, and you are in the room in under a minute."}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs text-white/50">Your rate · 30 min</dt>
              <dd className="mt-0.5 text-xl font-bold text-white">
                {props.rateCents > 0 && props.chargesEnabled
                  ? formatUsd(props.rateCents)
                  : "Free"}
              </dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs text-white/50">You keep</dt>
              <dd className="mt-0.5 text-xl font-bold text-teal-300">
                {props.rateCents > 0 && props.chargesEnabled
                  ? formatUsd(props.rateCents - Math.floor((props.rateCents * 1000) / 10_000))
                  : "—"}
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

          {!ready ? (
            <p className="mt-4 rounded-xl bg-amber-400/15 px-3.5 py-2.5 text-sm text-amber-200">
              Finish Stripe onboarding in Settings before charging. Until then you can still go on
              the radar, but sessions will be free.
            </p>
          ) : null}

          <button
            type="button"
            disabled={pending}
            onClick={() => flip(!online)}
            className={cn(
              "mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold transition-colors disabled:opacity-50",
              online
                ? "border border-white/20 text-white hover:bg-white/10"
                : "bg-teal-500 text-white shadow-lg shadow-teal-500/25 hover:bg-teal-400",
            )}
          >
            <Radio className="h-4 w-4" aria-hidden />
            {pending ? "Working…" : online ? "Go offline" : "Go on the radar"}
          </button>

          {!props.country ? (
            <p className="mt-2 text-center text-xs text-white/40">
              Add your country below and you will appear on the map.
            </p>
          ) : null}
        </div>
      </div>

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
