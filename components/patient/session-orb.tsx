import Link from "next/link";
import { Banknote, Video } from "lucide-react";

import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

/**
 * The session a patient has open, on every screen of their app. 79.3.
 *
 * ## 🔴 WHY THIS EXISTS
 *
 * A founder invited a patient to a paid session on production, paid it from
 * the patient's side, went back to the app, and there was nothing: no record
 * of the payment, no way into the session, nothing anywhere saying a session
 * existed at all. The payment sheet lives on `/pay/:token` and the join link
 * lives in an email, and the app itself held neither.
 *
 * The same argument the SOS orb makes in `chrome.tsx` applies here. It is
 * rendered by the chrome rather than by each page, because "every screen" is
 * the requirement, and a page that forgets it is a page somebody opens on the
 * evening of their appointment to find the product has lost it.
 *
 * ## 🔴 BELOW THE SOS ORB, PERMANENTLY
 *
 * The same rule `payment-popup.tsx` states: they can both be on screen, and if
 * they ever overlap the crisis button is the one on top. C235 is that a
 * patient's crisis path never depends on money, and a payment reminder
 * covering it would be that rule broken by a stacking context.
 *
 * ## What it says, and what it will not say
 *
 * A state and a door. No clinician name, no time, no price. An orb sits on a
 * screen other people read over a shoulder, and "you owe 350 for therapy with
 * Dr X at 4pm" is a disclosure to whoever is holding the phone. The banner
 * names the clinician, because it only appears once a session is live and the
 * person is seconds from seeing them anyway.
 */
export async function SessionOrb({
  session,
}: {
  session: { href: string; state: "owes" | "ready"; live: boolean } | null;
}) {
  if (!session) return null;

  const { t } = await getI18n();
  const label =
    session.state === "owes"
      ? t("porb.pay")
      : session.live
        ? t("porb.joinNow")
        : t("porb.ready");

  return (
    <Link
      href={session.href}
      aria-label={label}
      title={label}
      className={cn(
        /*
         * `bottom-24` clears the bottom navigation, and `z-[60]` sits under the
         * SOS orb exactly as the payment orb does. Two orbs agreeing on one
         * number is how they stay agreeing.
         */
        "fixed end-3 bottom-24 z-[60] flex h-12 w-12 items-center justify-center rounded-full shadow-[0_10px_24px_-8px_rgba(10,35,66,0.45)] ring-4 ring-white/80",
        session.state === "owes" ? "bg-amber-400 text-navy-600" : "bg-brand-500 text-navy-600",
      )}
    >
      {/*
        Shoot P12/P13/P19/P20: the icons used to be drawn from CSS borders, a
        box for a banknote and a box with one side missing for a door. On a
        phone the door read as a broken glyph, and nobody could tell the orb
        was the way into their session. They are the icon set's own now: a
        video camera for "your session is ready", a banknote for "pay".
      */}
      {session.state === "owes" ? (
        <Banknote aria-hidden className="h-5 w-5" strokeWidth={2.25} />
      ) : (
        <Video aria-hidden className="h-5 w-5" strokeWidth={2.25} />
      )}

      {/*
        🔴 A LIVE SESSION GETS A DOT, and it is the only moving thing here.
        A session that has started is the one state where a minute matters, so
        it is the one state that asks for attention rather than waiting to be
        found.
      */}
      {session.live ? (
        <span className="live-dot absolute -end-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
      ) : null}
    </Link>
  );
}
