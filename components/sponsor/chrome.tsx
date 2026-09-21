"use client";

import { signOutSponsor } from "@/app/(sponsor)/sponsor/sign-in/actions";
import { Desk } from "@/components/portal/desk";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * The sponsor's navigation. PLAN.md 53.4, 53.25, C240.
 *
 * ## 🔴 Five destinations, and not one of them leads to a person's session
 *
 * Overview, the list, the code, the pot, settings. There is no search, no
 * calendar, no "activity", and no way to open an individual: the roster row is
 * the deepest this portal goes and `lib/data/sponsors.ts` is why — its select
 * list has no session, no booking, no therapist and no date in it.
 *
 * A navigation bar is a map of what a product lets somebody do, so this one is
 * part of the wall rather than decoration on top of it.
 *
 * ## 🔴 C240's sentence is in the chrome, not on a help page
 *
 * *"An employer cannot mandate attendance through us."* It is on every screen of
 * this portal, because the person who needs to read it is the one drafting a
 * policy, and they will not click through to find out that they cannot.
 */

const TABS: { href: string; key: MessageKey }[] = [
  { href: "/sponsor", key: "sponsor.nav.overview" },
  { href: "/sponsor/people", key: "sponsor.nav.people" },
  { href: "/sponsor/code", key: "sponsor.nav.code" },
  { href: "/sponsor/pot", key: "sponsor.nav.pot" },
  /*
   * 🔴 61.1 — proving the domain is a setup task with a state, not a settings
   * field. It gets a tab because it stays visibly unfinished until it is
   * finished (C320) and because somebody has to come back to it days later.
   */
  { href: "/sponsor/domains", key: "sponsor.nav.domains" },
  /*
   * 🔴 66.1 — A PAGE, NOT A ROW IN SETTINGS.
   *
   * Connecting an HR system is a project somebody schedules. A settings row gets
   * flipped by whoever is in settings that afternoon; a page with four steps on it
   * gets opened by the person who came to do this.
   */
  { href: "/sponsor/integrations", key: "sponsor.nav.integrations" },
  { href: "/sponsor/settings", key: "sponsor.nav.settings" },
];

/**
 * 🔴 THIS FILE IS NOW THE SPONSOR'S ANSWERS, AND `Desk` IS THE QUESTIONS.
 *
 * What stayed here: the section list above and every word of why it is that
 * short, the sign out action, and the three sentences of the wall. Those are
 * facts about this portal. What left: a header, a nav, a column and a footer
 * that were byte for byte the clinic's, and are now one component both render.
 */
export function SponsorChrome({
  children,
  nav,
  bare = false,
  sponsorName,
  role,
}: {
  children: React.ReactNode;
  /** Signed out gets the door and no rail: every link would bounce them. */
  nav: boolean;
  bare?: boolean;
  sponsorName: string | null;
  role: "admin" | "viewer" | null;
}) {
  const t = useT();

  return (
    <Desk
      nav={nav}
      bare={bare}
      home="/sponsor"
      name={sponsorName}
      badge={role === "viewer" ? t("sponsor.nav.overview") : null}
      sections={TABS.map((tab) => ({
        href: tab.href,
        label: t(tab.key),
        exact: tab.href === "/sponsor",
      }))}
      actions={
        <form action={signOutSponsor}>
          <button
            type="submit"
            className="tap-target h-9 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            {t("sponsor.signOut")}
          </button>
        </form>
      }
      never={{
        label: t("sponsor.neverLabel"),
        items: [
          t("sponsor.neverIndividual"),
          t("sponsor.neverAttendance"),
          t("sponsor.neverClinical"),
        ],
      }}
    >
      {children}
    </Desk>
  );
}
