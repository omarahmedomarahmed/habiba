"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";

import { saveRadarSetup, toggleRadar, type RadarState } from "@/app/(app)/on-call/actions";
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
                ? "Anyone on the public radar can see you and start a session with you right now. You will hear an alarm anywhere in the app."
                : "Go online when you have a free half hour. You stay on the radar while 24Therapy is open, and drop off about a minute after you close it."}
            </p>
          </div>
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
