"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutClinic } from "@/app/(clinic)/clinic/sign-in/actions";
import { switchToClinician } from "@/app/(clinic)/clinic/team/actions";
import type { ClinicCapability } from "@/lib/clinic-auth/capabilities";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * The clinic's navigation. PLAN.md 54.9, 54.12, §3f.
 *
 * ## 🔴 THREE DESTINATIONS, AND THE LIST IS PART OF THE WALL
 *
 * This week, your clinicians, your bills. There is no patient list, no search, no
 * session, no note, no caseload and no way to open an individual. A navigation bar is
 * a map of what a product lets somebody do, so the shortness of this one is a design
 * decision rather than an unfinished screen.
 *
 * 🔴 There is no "patients" tab and there never will be. The nearest thing is a NAME
 * ON A SCHEDULE ROW, which is not a link, because there is nowhere for it to go.
 *
 * ## 🔴 THE SENTENCE ABOUT WHAT THIS PORTAL CANNOT SHOW IS IN THE CHROME
 *
 * On every screen, not on a help page. The person who needs to read it is a practice
 * manager wondering where the notes are, and they will not click through to find out
 * that the answer is "nowhere, on purpose".
 */

/**
 * 🔴 63.4 / C325 — THIS LIST IS NOT THE PERMISSION, AND SAYING SO IS THE POINT.
 *
 * *"Custom access levels to pages" is the classic authorisation hole. A navigation
 * filter is not a permission.* Every capability named here is checked again by
 * `requireClinicCapability` on the page and a third time by `refuseWithout` inside
 * the query, on the resource. Drawing fewer tabs is a courtesy so nobody taps a link
 * that bounces; it is not what keeps anybody out.
 */
const TABS: { href: string; key: MessageKey; needs: ClinicCapability }[] = [
  { href: "/clinic", key: "clinic.nav.overview", needs: "schedule.read" },
  { href: "/clinic/people", key: "clinic.nav.people", needs: "people.read" },
  { href: "/clinic/bills", key: "clinic.nav.bills", needs: "bills.read" },
  /* 🔴 63.15 — a DIFFERENT page from the therapist's own, never the same one filtered. */
  { href: "/clinic/earnings", key: "clinic.nav.earnings", needs: "earnings.read" },
  /* 🔴 63.8 — the practice's own staff and the roles it names. */
  { href: "/clinic/team", key: "clinic.nav.team", needs: "team.manage" },
  /*
   * 🔴 43.1c — a fourth destination, and it is not a clinical one.
   *
   * The wall 54.9 built is about PEOPLE: no patient list, no search, no note, no caseload. A
   * records connection is the practice's own integration setting, which is the same kind of thing
   * as its bills. It reaches `lib/data/ehr` and nothing clinical, and `verify:sprint43` renders
   * this chrome and sweeps its markup exactly as `verify:sprint54` does.
   */
  { href: "/clinic/records", key: "records.title", needs: "team.manage" },
];

export function ClinicChrome({
  children,
  nav,
  clinicName,
  capabilities = [],
  linked = false,
}: {
  children: React.ReactNode;
  /** Signed out gets the door and no tabs: every tab would bounce them. */
  nav: boolean;
  clinicName: string | null;
  /** What this principal holds. See the note on TABS: a courtesy, not a gate. */
  capabilities?: readonly ClinicCapability[];
  /** 🔴 63.2 / C352 — whether this human also has a clinician account here. */
  linked?: boolean;
}) {
  const t = useT();
  /*
   * 🔴 `?? "/clinic"`, and this was found by RENDERING it rather than by reading it.
   *
   * `usePathname` returns null outside a router context, and `verify:sprint54` renders
   * this component to sweep its markup for clinical words (54.9). Without the fallback it
   * threw on `pathname.startsWith`, which is a crash in the verifier and would also be a
   * crash anywhere else this is rendered outside a route: a test, a story, an error
   * boundary. The fallback is the portal's own home, so the first tab reads as active,
   * which is the correct thing for a chrome with no path to highlight.
   */
  const pathname = usePathname() ?? "/clinic";

  return (
    <div className="min-h-dvh bg-slate-50">
      {nav ? (
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="text-sm font-bold tracking-tight text-slate-900">{clinicName}</span>
            {/*
              🔴 63.2 / C352 — THE SWITCHER, and it is a handover rather than a link.

              A therapist who upgraded is a clinician AND the practice's admin. The
              two principals have separate cookies, which means both could be live at
              once unless something ends one of them: pressing this revokes every
              clinic session this person holds and then signs them in as the
              clinician, in that order, audited.
            */}
            {linked ? (
              <form action={switchToClinician} className="ms-auto">
                <button
                  type="submit"
                  className="tap-target h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t("clinic.switchToClinician")}
                </button>
              </form>
            ) : null}

            <form action={signOutClinic} className={linked ? "" : "ms-auto"}>
              <button
                type="submit"
                className="tap-target h-9 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                {t("clinic.signOut")}
              </button>
            </form>
          </div>

          <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3 pb-2">
            {TABS.filter((tab) => capabilities.includes(tab.needs)).map((tab) => {
              const active =
                tab.href === "/clinic" ? pathname === "/clinic" : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={
                    active
                      ? "tap-target whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                      : "tap-target whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  }
                >
                  {t(tab.key)}
                </Link>
              );
            })}
          </nav>
        </header>
      ) : null}

      <div className="mx-auto max-w-4xl px-4 py-8">{children}</div>

      {nav ? (
        <footer className="mx-auto max-w-4xl px-4 pb-10">
          {/* 🔴 54.9 — on every screen of this portal, in the chrome. */}
          <p className="border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
            {t("clinic.neverSees")}
          </p>
        </footer>
      ) : null}
    </div>
  );
}
