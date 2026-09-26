import type { Metadata } from "next";

import Link from "next/link";
import { redirect } from "next/navigation";

import { JoinFlow } from "@/components/join/join-flow";
import { PatientChrome } from "@/components/patient/chrome";
import { optionalPatient } from "@/lib/patient-auth/guard";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { Logo } from "@/components/brand/logo";
import { crisisCountryFor } from "@/lib/crisis/line";
import { getI18n } from "@/lib/i18n/server";
import { confirmCheckout } from "@/lib/billing/stripe";
import { feedbackContext, feedbackTokenForJoin } from "@/lib/data/feedback";
import { releaseClaim } from "@/lib/data/radar";
import { resolveJoinToken } from "@/lib/data/sessions";
import { benefitShortfall } from "@/lib/billing/pot";
import { BenefitNote } from "@/components/patient/benefit-note";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { patients, therapistRadar, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { callerKey, releaseHold } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/utils";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/join/[token]/page.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/** W3: the tab title in the reader's language. A join or pay link is never indexed. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.joinSession"), robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ checkout?: string; booked?: string }>;
}) {
  const { token } = await params;
  const { checkout, booked } = await searchParams;
  const { locale, t } = await getI18n();

  // Settle on the redirect as well as by webhook. Stripe cannot reach a preview
  // deployment, and a patient who has just paid must not be told to pay again.
  if (checkout && checkout !== "cancelled") {
    await confirmCheckout(checkout);
  }

  const session = await resolveJoinToken(token);

  // Abandoning the checkout puts a radar clinician straight back on the board
  // rather than holding them for the full claim window. The patient can still
  // try again from this page; if someone else has taken the slot by then, the
  // claim they lose is one they had already walked away from.
  if (checkout === "cancelled" && session) {
    await releaseClaim(session.id);
    // And give this address its booking slot back, so they can pick someone
    // else without waiting out the hold they just walked away from.
    await releaseHold(await callerKey("radar:hold"));
  }

  if (!session) {
    /*
     * A finished session is not a dead link.
     *
     * `resolveJoinToken` returns nothing once a session ends, so a patient who
     * closed the tab and came back used to be told the link was broken. It is
     * not broken — it is now the way to their summary, and it is the only
     * moment we will ever get their rating.
     */
    const rateToken = await feedbackTokenForJoin(token);
    if (rateToken && (await feedbackContext(rateToken))) redirect(`/feedback/${rateToken}`);

    return (
      <Shell>
        <h1 className="text-xl font-bold text-navy-700">{t("room.linkDead")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-navy-400">{t("room.linkDeadBody")}</p>
        {/*
          🔴 W2-P16: a dead link with nowhere to go. Somebody who needs a
          session now gets the radar; somebody signed in, their own sessions.
        */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/radar"
            className="inline-flex h-11 items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-navy-600"
          >
            {t("tab.radar")}
          </Link>
          {(await optionalPatient()) ? (
            <Link
              href="/patient/sessions"
              className="inline-flex h-11 items-center rounded-xl bg-navy-50 px-4 text-sm font-semibold text-navy-600"
            >
              {t("psessions.title")}
            </Link>
          ) : null}
        </div>
      </Shell>
    );
  }

  /*
   * Who the patient is about to talk to.
   *
   * The room used to be a bare video frame with no indication of whose face
   * was about to appear. A person in crisis who booked ninety seconds ago
   * deserves to see the name and the credentials of the clinician they picked,
   * on the screen, while they wait.
   */
  /*
   * 🔴 79.2 — IS THE PERSON READING THIS THE PATIENT ON THIS SESSION?
   *
   * The join route was built for a stranger on a bare link and it is right to
   * be: most people it reaches have never signed in. But the same link arrives
   * by email to somebody who HAS an account and a record, and it asked them to
   * type their first name as though nobody had ever met them.
   *
   * Proved by a `patients` row joining the signed-in person to this session's
   * patient, never by a matching name or address. A person has several
   * `patients` rows, one per organisation, so the question is whether any of
   * theirs IS the one on the session.
   *
   * Null for everybody else, and the form is exactly what it always was.
   */
  const signedIn = await optionalPatient();
  let knownName: string | null = null;
  if (signedIn && session.patientId) {
    const [mine] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(eq(patients.id, session.patientId), eq(patients.personId, signedIn.personId)),
      )
      .limit(1);
    if (mine) knownName = signedIn.firstName;
  }

  const [clinician] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      profile: users.profile,
      languages: therapistRadar.languages,
      timezone: users.timezone,
    })
    .from(users)
    .leftJoin(therapistRadar, eq(therapistRadar.userId, users.id))
    .where(eq(users.id, session.therapistId))
    .limit(1);

  /*
   * 🔴 THE START RULING: a booked session opens on one clock for both sides
   * (`lib/sessions/start-window.ts`). The booked instant and the thresholds go
   * to the browser so the page moves from the time, to "Starting soon", to
   * "Join early" while they sit on it; the actions refuse an early join
   * whatever the page shows. The time is written here, in the reader's zone:
   * their own, then the one this record keeps, then their clinician's (13.13).
   */
  let booking: React.ComponentProps<typeof JoinFlow>["booking"] = null;
  if (session.status === "scheduled" && session.scheduledAt) {
    const [record] = session.patientId
      ? await db
          .select({ timezone: patients.timezone })
          .from(patients)
          .where(eq(patients.id, session.patientId))
          .limit(1)
      : [];
    const zone = signedIn?.timezone || record?.timezone || clinician?.timezone || null;
    booking = {
      at: session.scheduledAt.toISOString(),
      label: formatDateTime(session.scheduledAt, zone, locale),
      rule: (await getSettings()).rules.start,
      serverNow: Date.now(),
    };
  }

  return (
    /*
     * 🔴 25.2 / 25.4 / C129 — the live session is a patient screen.
     *
     * It is not in the `(patient)` route group, because a join link has to work
     * for somebody who has never signed in, so it takes the chrome directly.
     * `live` locks the Session tab and makes every other destination ask first.
     *
     * 🔴 P14: ONLY WHILE THE SESSION IS ACTUALLY RUNNING. It was passed on every
     * render, so a link for next Tuesday, or one still waiting to be paid,
     * asked "leave the session?" on every tap of the bar and dimmed the SOS
     * orb, on a screen where there was no session to leave. `in_progress` is
     * the state `startSession` writes when the clinician opens the room, and
     * the one `readSessionClock` calls live.
     */
    <Shell live={session.status === "in_progress" ? { href: `/join/${token}` } : null}>
      <JoinFlow
        feedbackToken={await feedbackTokenForJoin(token)}
        therapist={{
          name: [clinician?.firstName, clinician?.lastName].filter(Boolean).join(" ") || t("join.yourTherapist"),
          firstName: clinician?.firstName ?? t("join.yourTherapistLower"),
          credentials: clinician?.profile?.credentials ?? null,
          languages: clinician?.languages ?? [],
        }}
        token={token}
        modality={session.modality}
        /* 🔴 What they owe, after their benefit and with VAT: the pay page's figure. */
        priceCents={
          session.priceCents > 0 && session.paymentStatus !== "paid"
            ? await (await import("@/lib/billing/manual-entry")).patientOwesTotal(session.id)
            : session.priceCents
        }
        paymentStatus={session.paymentStatus}
        /* 🔴 Board 301: the same question the pay page asks before it offers a card. */
        cardsLive={await (await import("@/lib/billing/egypt")).railIsReady()}
        /*
         * 🔴 A DROPPED CONNECTION IS NOT A NEW ARRIVAL.
         *
         * This used to also require `checkout` or `booked=1` in the query
         * string, so it resumed only for somebody coming back from Stripe or
         * straight off the radar. Every other way of arriving at this URL a
         * second time — a reload, a dropped connection, a phone waking up, a
         * tab restored — was treated as a stranger and sent back to "tell us
         * what to call you", after they had already given their name, already
         * answered the recording question, and already been in the room.
         *
         * Walked on production: a patient in the room, reloaded, and got the
         * first form back. Every time.
         *
         * The query string was never what made resuming safe. The token is:
         * it is the credential, it names exactly one session, and
         * `resumeAfterPayment` re-reads the stored name from that session
         * rather than trusting anything the browser sends.
         *
         * So the two existing entrances stay exactly as they were, and one
         * more is added: `patientJoinedAt`, which is set only by
         * `joinByToken` and therefore means this person has already been
         * admitted to this session once. That is the narrowest possible
         * statement of "this is a return, not an arrival", and it leaves a
         * genuine first arrival — no `patientJoinedAt`, no query string —
         * seeing the form it should see.
         *
         * The paywall is untouched: a priced session that has not settled
         * still refuses to resume.
         */
        resumeAfterPayment={
          Boolean(session.guestName) &&
          (session.priceCents === 0 || session.paymentStatus === "paid") &&
          (Boolean(checkout) || booked === "1" || Boolean(session.patientJoinedAt))
        }
        cancelled={checkout === "cancelled"}
        /* 🔴 79.2 — their own name, when this is their own session. */
        knownName={knownName}
        /* Already answered, so the room does not open by denying it. */
        initialConsent={{
          recording: session.recordingConsent,
          profileShare: session.profileShareConsent,
        }}
        /*
          🔴 Sprint 14's recovery, on the screen where the waiting happens, and
          🔴 W2-P11 inside the room as well as before it. It was rendered here,
          below the flow, where the room's fixed full-screen layer covered it
          the moment the patient went in, and it was handed a wait computed
          once, so a room opened before the five minutes never offered anybody.
          The booked instant goes in; the component keeps the clock.
        */
        booking={booking}
        recoveryFrom={
          session.scheduledAt && !session.startedAt ? session.scheduledAt.toISOString() : null
        }
        /* 🔴 W2-P15 / E5: a benefit that did not pay says who to ask, beside the price. */
        benefitNote={<BenefitNote shortfall={await benefitShortfall(session.id)} />}
      />
      {/*
        `NoShowRecovery` was built in sprint 14 and rendered nowhere, found by a
        type error asking who passes the new locale. A component nobody renders
        is a feature nobody has. `JoinFlow` renders it now, in both places.
      */}
    </Shell>
  );
}

async function Shell({
  children,
  live = null,
}: {
  children: React.ReactNode;
  live?: { href: string } | null;
}) {
  const { locale, t } = await getI18n();
  /*
   * The bar only appears for somebody who can use it. A guest on a bare link
   * has no account, so every destination in it would bounce them to a login
   * screen. The SOS orb inside the chrome is not conditional on anything.
   */
  const patient = await optionalPatient();
  return (
    <PatientChrome
      nav={patient !== null}
      liveSession={live}
      phone={patient?.phone ?? null}
      /* 🔴 75.4 — a stranger from the radar has no phone. The language is the signal. */
      country={crisisCountryFor({ locale })}
    >
    <div className="flex min-h-dvh flex-col bg-navy-50">
      {/*
        The language switch belongs here, not buried in a menu.
        --------------------------------------------------------
        This page is the entire patient surface — no account, no settings, no
        second visit. Somebody who lands on it in the wrong language has one
        chance to fix that, and it has to be visible without scrolling.
      */}
      <header className="flex items-center justify-between px-4 py-5 sm:px-6">
        <Logo ink="navy" height={26} />
        <LanguageSwitch />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 sm:items-center sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="px-4 pb-6 text-center sm:px-6">
        <p className="text-xs text-navy-400">{t("urgent.footer")}</p>
      </footer>
    </div>
    </PatientChrome>
  );
}
