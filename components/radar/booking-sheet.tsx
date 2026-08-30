"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import {
  Clock,
  CreditCard,
  DoorOpen,
  Globe2,
  Languages,
  Mail,
  Navigation,
  ShieldCheck,
  Sparkles,
  X, ChevronRight } from "lucide-react";

import {
  bookFromRadar,
  emailDirections,
  releaseViewing,
  reserveForViewing,
  type BookingState,
} from "@/app/(public)/radar/actions";
import { Avatar, StatusPill } from "@/components/radar/therapist-card";
import type { RadarEntry } from "@/components/radar/types";
import { Field, Input } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import { countryName } from "@/lib/geo";
import { cn, fullName } from "@/lib/utils";
import { viewerId } from "@/lib/viewer";

/** Must match RESERVATION_SECONDS on the server. */
const HOLD_SECONDS = 60;
/** Renew comfortably before expiry, so a slow request cannot drop the hold. */
const RENEW_MS = 20_000;

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
  const [viewer] = useState(() => viewerId());
  const [outcome, setOutcome] = useState<"held" | "taken" | "unavailable" | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  const [secondsLeft, setSecondsLeft] = useState(HOLD_SECONDS);
  const submittedRef = useRef(false);

  const bookable = entry.status === "online" || entry.reservedByYou;

  /*
   * Take the clinician off the board while this sheet is open, and put them
   * straight back when it closes.
   *
   * The hold is renewed rather than set once, so a sheet that stays open stays
   * valid — but it is only sixty seconds long, so a tab left open on a bus
   * cannot keep a clinician out of circulation. The countdown below tells the
   * visitor that, in those words, because a silent timeout that closes a
   * booking form would be baffling.
   */
  useEffect(() => {
    if (!bookable || !viewer) return;

    let cancelled = false;

    const hold = async () => {
      const result = await reserveForViewing(entry.userId, viewer);
      if (cancelled) return;
      setOutcome(result.outcome);
      if (result.outcome === "held") setSecondsLeft(HOLD_SECONDS);
    };

    void hold();
    const renew = setInterval(hold, RENEW_MS);

    return () => {
      cancelled = true;
      clearInterval(renew);
      // Do not release a hold that has just become a real booking.
      if (!submittedRef.current) void releaseViewing(entry.userId, viewer);
    };
  }, [entry.userId, viewer, bookable]);

  // The visible clock. Closing on zero is the promise the copy makes.
  useEffect(() => {
    if (!bookable || outcome === "taken" || outcome === "unavailable") return;

    const tick = setInterval(() => {
      setSecondsLeft((left) => {
        if (left <= 1) {
          if (!submittedRef.current) onClose();
          return 0;
        }
        return left - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [bookable, outcome, onClose]);

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

  /*
   * Rendered into `document.body`, not where it sits in the tree.
   *
   * The homepage hero is `relative isolate`, which creates a stacking context
   * — so this sheet's z-index was only ever competing with the hero's other
   * children, never with the site header at z-40 in the root context. The
   * header painted straight over the top of the profile, cutting off the
   * clinician's name and photograph. No z-index on this element could have
   * fixed that; it had to leave the context entirely.
   *
   * `mounted` guards the first render, because `document` does not exist on
   * the server.
   */
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-navy-600/70 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${fullName(entry.firstName, entry.lastName, "Clinician")} profile`}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0" />

      <div className="animate-fade-rise relative my-auto max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="tap-target absolute top-3 end-3 flex items-center justify-center text-slate-400 hover:text-slate-700"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <div className="flex items-start gap-3.5 pe-8">
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
            {[entry.city, entry.region, countryName(entry.country)].filter(Boolean).join(", ") ||
              "Not shared"}
          </Row>
        </dl>

        {/*
          A way out of the sheet that is not "close".

          Somebody deciding whether to sit down with a stranger for half an
          hour is allowed to want more than four lines about them. The profile
          is a real page with a real URL, which also means the clinician has
          something to hand out.
        */}
        <a
          href={`/t/${entry.userId}`}
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          See their full profile
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </a>

        {entry.practice ? <WalkIn entry={entry} /> : null}

        {bookable ? (
          <form
            action={action}
            onSubmit={() => {
              // From here the reservation becomes a booking claim; unmounting
              // must not hand the clinician back.
              submittedRef.current = true;
            }}
            className="mt-5 space-y-4"
          >
            <input type="hidden" name="therapistId" value={entry.userId} />
            <input type="hidden" name="viewer" value={viewer} />

            {/*
              The clock, and why it is running. A booking form that vanishes
              without explanation is a bug from the visitor's side; a booking
              form that tells you a clinician is being held for you and someone
              else may need them is a reason to get on with it.
            */}
            {outcome !== "taken" && outcome !== "unavailable" ? (
              <div className="rounded-2xl bg-teal-50 px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-900">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    Held for you · {secondsLeft}s
                  </p>
                  <p className="text-[11px] text-teal-700">You are the only one who can book them</p>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-teal-200"
                  role="progressbar"
                  aria-valuenow={secondsLeft}
                  aria-valuemin={0}
                  aria-valuemax={HOLD_SECONDS}
                  aria-label="Time left to complete this booking"
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-1000 ease-linear",
                      secondsLeft > 20 ? "bg-teal-500" : "bg-amber-500",
                    )}
                    style={{ width: `${(secondsLeft / HOLD_SECONDS) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-teal-800">
                  This therapist now shows as busy to everyone else. Finish your booking, or close
                  this page so someone else can reach them.
                </p>
              </div>
            ) : (
              /*
                Two different failures, said differently, because they used to
                share one sentence that was usually a lie: "someone else opened
                this profile" was printed whether the clinician was taken,
                stale, suspended or in a session — and most often nobody else
                was there at all.
              */
              <p className="rounded-2xl bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-800">
                {outcome === "taken"
                  ? "Someone else is on this profile right now. You can still try — if they do not go ahead, this clinician frees up within a minute."
                  : "This clinician has just become unavailable. Close this and pick someone else — the board updates every few seconds."}
              </p>
            )}

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
              ? "Someone is with them on this page right now. If they do not go ahead, this clinician is back on the radar within a minute — this page updates by itself."
              : "They are in a session at the moment. They will reappear on the radar as soon as they are free."}
          </p>
        )}
      </div>
    </div>,
    document.body,
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

/**
 * "You can also just come in."
 *
 * Only rendered for a clinician who confirmed a pin and switched walk-ins on,
 * so everything here is an address someone deliberately published. The link
 * opens the patient's own maps app rather than embedding a map: an iframe from
 * a third-party tile provider on a page someone in crisis is using is a
 * tracking beacon and a slow load, for a button they already have on their
 * phone.
 *
 * Emailing directions exists because the person reading this may be on a
 * laptop and travelling on a phone, and because a written address survives a
 * closed tab.
 */
function WalkIn({ entry }: { entry: RadarEntry }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

  const practice = entry.practice!;
  const mapsUrl =
    practice.lat && practice.lon
      ? `https://www.google.com/maps/dir/?api=1&destination=${practice.lat},${practice.lon}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(practice.address)}`;

  const send = async () => {
    setError(null);
    setSending(true);
    const result = await emailDirections(entry.userId, email);
    setSending(false);
    if (result.error) setError(result.error);
    else setSent(true);
  };

  return (
    <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50/60 p-3.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-teal-700 uppercase">
        <DoorOpen className="h-3 w-3" aria-hidden />
        Accepts walk-in visits
      </p>
      {practice.name ? (
        <p className="mt-1.5 text-sm font-semibold text-teal-900">{practice.name}</p>
      ) : null}
      <p className="mt-0.5 text-sm leading-relaxed text-teal-900">{practice.address}</p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700"
        >
          <Navigation className="h-3.5 w-3.5" aria-hidden />
          Get directions
        </a>
        {!open && !sent ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden />
            Email me the address
          </button>
        ) : null}
      </div>

      {sent ? (
        <p className="mt-2 text-xs text-teal-800">Sent. Check your inbox.</p>
      ) : open ? (
        <div className="mt-2.5 space-y-1.5">
          {error ? (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Input
              aria-label="Where to send the directions"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              autoCapitalize="none"
              placeholder="you@example.com"
              className="h-10 text-sm"
            />
            <button
              type="button"
              disabled={sending || !email.includes("@")}
              onClick={send}
              className="shrink-0 rounded-xl bg-teal-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-teal-700">
            We send the address and nothing else, once. It is not stored and you are not signed up
            to anything.
          </p>
        </div>
      ) : null}

      <p className="mt-2.5 text-[11px] leading-relaxed text-teal-700">
        Turning up is not an appointment. Booking a session above is the only way to be certain
        someone is free.
      </p>
    </div>
  );
}
