"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Globe2, Languages, ShieldCheck, Sparkles, X } from "lucide-react";

import { bookFromRadar, type BookingState } from "@/app/(public)/radar/actions";
import { WorldRadar, type RadarDot } from "@/components/radar/world-radar";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import { countryName } from "@/lib/geo";
import { cn, fullName, initials } from "@/lib/utils";

export type RadarEntry = {
  userId: string;
  firstName: string;
  lastName: string | null;
  credentials: string | null;
  headline: string | null;
  photoUrl: string | null;
  languages: string[];
  specialties: string[];
  country: string | null;
  rateCents: number;
  status: "online" | "pending" | "in_session";
};

const INITIAL: BookingState = {};

function BookButton({ rateCents }: { rateCents: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="teal" full disabled={pending}>
      {pending
        ? "Connecting…"
        : rateCents > 0
          ? `Pay ${formatUsd(rateCents)} and start now`
          : "Start now"}
    </Button>
  );
}

/**
 * The public radar.
 *
 * Everything here is the clinician's own published profile: name, credentials,
 * languages, what they work with, their rate and their country. No patient data
 * touches this component and no authenticated call is made — a person in crisis
 * gets a list and a button, not a signup form.
 *
 * The list refreshes on a timer because availability changes underneath it. A
 * stale radar sends someone to a clinician who is already with another patient,
 * which for this audience is not a minor inconvenience.
 */
export function PublicRadar({
  initial,
  compact,
}: {
  initial: RadarEntry[];
  /** Hero mode: the map, a count and a link — not the whole board. */
  compact?: boolean;
}) {
  const [entries, setEntries] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, action] = useActionState(bookFromRadar, INITIAL);

  useEffect(() => setEntries(initial), [initial]);

  // Refresh availability. Only when the tab is visible: a backgrounded
  // marketing page has no business polling.
  useEffect(() => {
    if (compact) return;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/radar", { cache: "no-store" });
        if (response.ok) setEntries((await response.json()).therapists as RadarEntry[]);
      } catch {
        // A failed refresh leaves the last good list on screen.
      }
    };
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  }, [compact]);

  useEffect(() => {
    if (state.payUrl) window.location.href = state.payUrl;
    else if (state.joinUrl) window.location.href = state.joinUrl;
  }, [state.payUrl, state.joinUrl]);

  const dots: RadarDot[] = useMemo(
    () =>
      entries.map((entry) => ({
        id: entry.userId,
        country: entry.country,
        status: entry.status,
        label: `${fullName(entry.firstName, entry.lastName, "Clinician")} · ${
          countryName(entry.country) ?? "Location not shared"
        }`,
      })),
    [entries],
  );

  const onlineCount = entries.filter((entry) => entry.status === "online").length;
  const selected = entries.find((entry) => entry.userId === selectedId) ?? null;

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      <div className="relative overflow-hidden rounded-3xl bg-navy-500">
        <div className={compact ? "aspect-[2/1]" : "aspect-[2/1] sm:aspect-[5/2]"}>
          <WorldRadar
            dots={dots}
            selectedId={selectedId}
            onSelect={compact ? undefined : setSelectedId}
          />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-navy-500 to-transparent px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <span
              className={cn(
                "live-dot h-2 w-2 rounded-full",
                onlineCount > 0 ? "bg-teal-400" : "bg-slate-500",
              )}
            />
            {onlineCount > 0
              ? `${onlineCount} ${onlineCount === 1 ? "therapist" : "therapists"} available now`
              : "No one on the radar this minute"}
          </p>
          {!compact ? (
            <p className="hidden text-xs text-white/50 sm:block">Tap a dot to see who it is</p>
          ) : null}
        </div>
      </div>

      {compact ? null : (
        <>
          {state.error ? (
            <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {state.error}
            </p>
          ) : null}

          {entries.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm font-semibold text-slate-900">Nobody is on the radar yet</p>
              <p className="mt-1.5 text-sm text-slate-600">
                Clinicians appear here the moment they go online. If you need help right now, call
                or text 988.
              </p>
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {entries.map((entry) => (
                <li key={entry.userId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(entry.userId)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                      entry.status === "online"
                        ? "border-slate-200 bg-white hover:border-teal-400"
                        : "border-slate-200 bg-slate-50",
                    )}
                  >
                    <Avatar entry={entry} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {fullName(entry.firstName, entry.lastName, "Clinician")}
                        </span>
                        <StatusBadge status={entry.status} />
                      </span>
                      {entry.credentials ? (
                        <span className="block truncate text-xs text-slate-500">
                          {entry.credentials}
                        </span>
                      ) : null}
                      <span className="mt-1 block truncate text-xs text-slate-500">
                        {entry.languages.slice(0, 3).join(" · ") || "Language not listed"}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-slate-900">
                      {entry.rateCents > 0 ? formatUsd(entry.rateCents) : "Free"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy-500/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${fullName(selected.firstName, selected.lastName, "Clinician")} profile`}
        >
          <div className="animate-fade-rise max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="flex items-start gap-3">
              <Avatar entry={selected} large />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold tracking-tight text-slate-900">
                  {fullName(selected.firstName, selected.lastName, "Clinician")}
                </p>
                {selected.credentials ? (
                  <p className="text-sm text-slate-500">{selected.credentials}</p>
                ) : null}
                <div className="mt-1.5">
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close"
                className="tap-target -mt-1 -mr-1 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {selected.headline ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-700">{selected.headline}</p>
            ) : null}

            <dl className="mt-4 space-y-2.5 text-sm">
              <Row icon={<Languages className="h-3.5 w-3.5" aria-hidden />} label="Speaks">
                {selected.languages.join(", ") || "Not listed"}
              </Row>
              <Row icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />} label="Works with">
                {selected.specialties.join(", ") || "Not listed"}
              </Row>
              <Row icon={<Globe2 className="h-3.5 w-3.5" aria-hidden />} label="Based in">
                {countryName(selected.country) ?? "Not shared"}
              </Row>
            </dl>

            {selected.status === "online" ? (
              <form action={action} className="mt-5 space-y-4">
                <input type="hidden" name="therapistId" value={selected.userId} />

                <div className="flex items-baseline justify-between rounded-2xl bg-navy-500 px-4 py-3 text-white">
                  <span className="text-sm text-white/70">30 minutes, starting now</span>
                  <span className="text-2xl font-bold tracking-tight">
                    {selected.rateCents > 0 ? formatUsd(selected.rateCents) : "Free"}
                  </span>
                </div>

                <Field label="Your first name" htmlFor="radar-name">
                  <Input
                    id="radar-name"
                    name="name"
                    autoComplete="given-name"
                    autoCapitalize="words"
                    required
                  />
                </Field>

                <Field label="Email" htmlFor="radar-email" hint="Optional — for your receipt.">
                  <Input
                    id="radar-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </Field>

                <BookButton rateCents={selected.rateCents} />

                <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  No account needed. Payment goes to your therapist through Stripe. If you are in
                  immediate danger, call your local emergency number or text 988.
                </p>
              </form>
            ) : (
              <p className="mt-5 rounded-xl bg-slate-100 px-3.5 py-3 text-sm text-slate-600">
                {selected.status === "pending"
                  ? "Someone is booking them right now. If they do not go ahead, this clinician will be back on the radar within a few minutes."
                  : "They are with someone at the moment. Try another clinician, or check back shortly."}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <dt className="flex w-24 shrink-0 items-center gap-1.5 text-slate-400">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-slate-700">{children}</dd>
    </div>
  );
}

function Avatar({ entry, large }: { entry: RadarEntry; large?: boolean }) {
  const size = large ? "h-14 w-14 text-base" : "h-10 w-10 text-xs";
  if (entry.photoUrl) {
    return (
      // Deliberately a plain <img>: the URL is admin/clinician-supplied and the
      // image optimiser would happily fetch arbitrary hosts on our behalf.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={entry.photoUrl}
        alt=""
        className={cn("shrink-0 rounded-2xl object-cover", size)}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl bg-navy-500 font-semibold text-white",
        size,
      )}
    >
      {initials(entry.firstName, entry.lastName ?? "")}
    </span>
  );
}

function StatusBadge({ status }: { status: RadarEntry["status"] }) {
  if (status === "online") return <Badge tone="teal">Available now</Badge>;
  if (status === "pending") return <Badge tone="amber">Being booked</Badge>;
  return <Badge tone="slate">In session</Badge>;
}
