import { PatientBottomNav } from "@/components/patient/bottom-nav";
import { SessionOrb } from "@/components/patient/session-orb";
import { SosOrb } from "@/components/patient/sos-orb";
import { sosCountries } from "@/components/patient/sos-orb-server";

/**
 * The app chrome, in one place. PLAN.md 25.2, C129.
 *
 * ## 🔴 Why this is a component and not just a layout
 *
 * "Every patient screen lives inside the app chrome" is a claim about routes,
 * and two of the screens that matter most are not in the `(patient)` route
 * group at all: the radar, which is public and cacheable, and the live session
 * at `/join/[token]`, which a patient can reach from a link before they have
 * ever signed in. A layout cannot reach either of them.
 *
 * So the chrome is a component the layout uses, and those two pages use it as
 * well. Falling out of the app onto the marketing site's top nav in the middle
 * of a session is the failure this prevents.
 *
 * `liveSession` locks the session tab and makes leaving ask first (25.4).
 */
export async function PatientChrome({
  children,
  openSession = null,
  liveSession = null,
  nav = true,
  practiceNumber = null,
  phone = null,
  country = null,
}: {
  children: React.ReactNode;
  /**
   * 🔴 79.3 — THE SESSION THIS PERSON HAS OPEN, priced or paid.
   *
   * Rendered here for the reason the SOS orb is: "every screen" is the
   * requirement. A founder paid for a session on production, went back to the
   * app and found nothing at all, because the payment sheet lives on its own
   * route and the join link lives in an email.
   */
  openSession?: { href: string; state: "owes" | "ready"; live: boolean } | null;
  liveSession?: { href: string } | null;
  /**
   * A visitor who is not signed in gets the orb and no navigation, because
   * every destination in the bar would bounce them to a login screen. The orb
   * is not conditional on anything, ever.
   */
  nav?: boolean;
  practiceNumber?: string | null;
  /**
   * 🔴 37R.25 / C184 — the reader's own number, so the orb prints the crisis
   * line for THEIR country and not the only one in the table.
   */
  phone?: string | null;
  /**
   * 🔴 75.4 — for a GUEST, who has no phone and therefore had no crisis number.
   *
   * `/join/[token]` renders this chrome with `phone={patient?.phone ?? null}`,
   * and a stranger who arrived from the radar has no patient row at all. So on
   * the flagship flow the orb printed the generic sentence and nothing else.
   */
  country?: string | null;
}) {
  return (
    <div className="min-h-dvh bg-navy-50">
      <div className={nav || liveSession ? "pb-24" : undefined}>{children}</div>
      {nav || liveSession ? <PatientBottomNav liveSession={liveSession} /> : null}
      {/*
        🔴 25.5 / C125 / C126 — on every patient screen, including a live
        session, where it is dimmed rather than removed.

        Rendered here rather than on each page, because "every screen" is the
        requirement and a page that forgets it is a page somebody reaches on
        the night they need it.
      */}
      {/*
        🔴 UNDER the SOS orb, which is why it is rendered before it. Both can
        be on screen; if they ever overlap the crisis button is the one on top,
        because C235 is that a patient's crisis path never depends on money.
      */}
      <SessionOrb session={openSession} />
      <SosOrb
        dimmed={liveSession !== null}
        practiceNumber={practiceNumber}
        phone={phone}
        country={country}
        /* 🔴 W1-09: every configured country's line, for a reader we cannot place. */
        countries={await sosCountries()}
      />
    </div>
  );
}
