"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { CreditCard, Globe2, Languages, ShieldCheck, Sparkles, X } from "lucide-react";

import { bookFromRadar, type BookingState } from "@/app/(public)/radar/actions";
import { Avatar, StatusPill } from "@/components/radar/therapist-card";
import type { RadarEntry } from "@/components/radar/types";
import { Field, Input } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import { countryName } from "@/lib/geo";
import { fullName } from "@/lib/utils";

const INITIAL: BookingState = {};

function Submit({ rateCents }: { rateCents: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-teal-500 text-base font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
    >
      {rateCents > 0 ? <CreditCard className="h-4 w-4" aria-hidden /> : null}
      {pending
        ? "Connecting…"
        : rateCents > 0
          ? `Pay ${formatUsd(rateCents)} and start now`
          : "Start now"}
    </button>
  );
}

/**
 * The profile and booking sheet.
 *
 * Booking happens here, on whichever page the visitor is already on — the
 * homepage hero or the full radar. Sending someone in distress to a second page
 * to do the same thing is a step they may not take.
 */
export function BookingSheet({
  entry,
  onClose,
}: {
  entry: RadarEntry;
  onClose: () => void;
}) {
  const [state, action] = useActionState(bookFromRadar, INITIAL);

  useEffect(() => {
    if (state.payUrl) window.location.href = state.payUrl;
    else if (state.joinUrl) window.location.href = state.joinUrl;
  }, [state.payUrl, state.joinUrl]);

  // Escape closes, and the page behind must not scroll under the sheet.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-600/70 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${fullName(entry.firstName, entry.lastName, "Clinician")} profile`}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0" />

      <div className="animate-fade-rise relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="tap-target absolute top-3 right-3 flex items-center justify-center text-slate-400 hover:text-slate-700"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <div className="flex items-start gap-3.5 pr-8">
          <Avatar entry={entry} large />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold tracking-tight text-slate-900">
              {fullName(entry.firstName, entry.lastName, "Clinician")}
            </p>
            {entry.credentials ? (
              <p className="text-sm text-slate-500">{entry.credentials}</p>
            ) : null}
            <div className="mt-1.5">
              <StatusPill status={entry.status} />
            </div>
          </div>
        </div>

        {entry.headline ? (
          <p className="mt-4 text-sm leading-relaxed text-slate-700">{entry.headline}</p>
        ) : null}

        <dl className="mt-4 space-y-2.5 text-sm">
          <Row icon={<Languages className="h-3.5 w-3.5" aria-hidden />} label="Speaks">
            {entry.languages.join(", ") || "Not listed"}
          </Row>
          <Row icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />} label="Works with">
            {entry.specialties.join(", ") || "Not listed"}
          </Row>
          <Row icon={<Globe2 className="h-3.5 w-3.5" aria-hidden />} label="Based in">
            {countryName(entry.country) ?? "Not shared"}
          </Row>
        </dl>

        {entry.status === "online" ? (
          <form action={action} className="mt-5 space-y-4">
            <input type="hidden" name="therapistId" value={entry.userId} />

            {state.error ? (
              <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {state.error}
              </p>
            ) : null}

            <div className="flex items-baseline justify-between rounded-2xl bg-navy-500 px-4 py-3 text-white">
              <span className="text-sm text-white/70">30 minutes, starting now</span>
              <span className="text-2xl font-bold tracking-tight">
                {entry.rateCents > 0 ? formatUsd(entry.rateCents) : "Free"}
              </span>
            </div>

            <Field label="Your first name" htmlFor="radar-name">
              <Input
                id="radar-name"
                name="name"
                autoComplete="given-name"
                autoCapitalize="words"
                required
                autoFocus
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

            <Submit rateCents={entry.rateCents} />

            <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              No account needed. Payment goes to your therapist through Stripe — we never see your
              card. If you are in immediate danger, call your local emergency number or text 988.
            </p>
          </form>
        ) : (
          <p className="mt-5 rounded-xl bg-slate-100 px-3.5 py-3 text-sm text-slate-600">
            {entry.status === "pending"
              ? "Someone is booking them right now. If that booking does not go ahead they will be back on the radar within a few minutes."
              : "They are with someone at the moment. Try another clinician, or check back shortly."}
          </p>
        )}
      </div>
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
