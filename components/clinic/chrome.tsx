"use client";

import { signOutClinic } from "@/app/(clinic)/clinic/sign-in/actions";
import { switchToClinician } from "@/app/(clinic)/clinic/team/actions";
import type { ClinicCapability } from "@/lib/clinic-auth/capabilities";
import { LogOut, Stethoscope } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Desk } from "@/components/portal/desk";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

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
type Tab = { href: string; key: MessageKey; needs: ClinicCapability };

/*
 * 🔴 RULING 14b: SEVEN PLACES BECAME FOUR, and nothing was removed. Each group's
 * pages are tabs at the top of every one of them (`ClinicTabs`), filtered by the
 * same capabilities, so a manager who holds one page of a group sees that page.
 */
export const CLINIC_GROUPS: { key: MessageKey; tabs: Tab[] }[] = [
  { key: "clinic.nav.overview", tabs: [{ href: "/clinic", key: "clinic.nav.overview", needs: "schedule.read" }] },
  {
    key: "clinic.nav.people",
    tabs: [
      { href: "/clinic/people", key: "clinic.nav.people", needs: "people.read" },
      /* 🔴 63.8 — the practice's own staff and the roles it names. */
      { href: "/clinic/team", key: "clinic.nav.team", needs: "team.manage" },
    ],
  },
  {
    key: "clinic.nav.money",
    tabs: [
      { href: "/clinic/bills", key: "clinic.nav.bills", needs: "bills.read" },
      /* 🔴 63.15 — a DIFFERENT page from the therapist's own, never the same one filtered. */
      { href: "/clinic/earnings", key: "clinic.nav.earnings", needs: "earnings.read" },
      /* 🔴 W2-C02: the seats. Never delegable, so only the admin ever holds `seats.manage`. */
      { href: "/clinic/seats", key: "clinic.nav.seats", needs: "seats.manage" },
    ],
  },
  /*
   * 🔴 43.1c — not a clinical destination. The wall 54.9 built is about PEOPLE: no
   * patient list, no search, no note, no caseload. A records connection is the
   * practice's own integration setting, the same kind of thing as its bills. It
   * reaches `lib/data/ehr` and nothing clinical, and `verify:sprint43` renders this
   * chrome and sweeps its markup exactly as `verify:sprint54` does.
   */
  { key: "records.title", tabs: [{ href: "/clinic/records", key: "records.title", needs: "team.manage" }] },
];

/** Every page in the clinic's navigation, for the checks. */
export const CLINIC_PAGES = CLINIC_GROUPS.flatMap((group) => group.tabs.map((tab) => tab.href));

/** What this principal may open in each group; a group with nothing is not drawn. */
function allowedGroups(capabilities: readonly ClinicCapability[]) {
  return CLINIC_GROUPS.map((group) => ({ ...group, tabs: group.tabs.filter((tab) => capabilities.includes(tab.needs)) })).filter(
    (group) => group.tabs.length > 0,
  );
}

/*
 * The two session-ending buttons, drawn once and worn twice: white ink with
 * their words in the navy rail, a navy icon in the phone's top bar (the words
 * stay for a screen reader and as the tooltip).
 */
const DESK_ACTION =
  "tap-target inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-navy-600 ring-1 ring-navy-100 hover:bg-navy-50 group-data-[desk=rail]/desk:text-white/85 group-data-[desk=rail]/desk:ring-white/15 group-data-[desk=rail]/desk:hover:bg-white/10 group-data-[desk=rail]/desk:hover:text-white";
const DESK_LABEL = "sr-only group-data-[desk=rail]/desk:not-sr-only";

/** 🔴 Ruling 14b: the pages inside the current group, one tap away. */
function ClinicTabs({ capabilities }: { capabilities: readonly ClinicCapability[] }) {
  const t = useT();
  const pathname = usePathname() ?? "/clinic";
  const within = (href: string) => (href === "/clinic" ? pathname === href : pathname.startsWith(href));
  const group = allowedGroups(capabilities).find((g) => g.tabs.some((tab) => within(tab.href)));
  if (!group || group.tabs.length < 2) return null;
  return (
    <nav aria-label={t(group.key)} className="mb-6">
      <ul className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-navy-100 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {group.tabs.map((tab) => (
          <li key={tab.href} className="shrink-0">
            <Link
              href={tab.href}
              aria-current={within(tab.href) ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center rounded-full px-4 text-[14px] font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                within(tab.href) ? "bg-navy-600 text-white" : "text-navy-500 hover:text-navy-700",
              )}
            >
              {t(tab.key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * 🔴 THIS FILE IS NOW THE CLINIC'S ANSWERS, AND `Desk` IS THE QUESTIONS.
 *
 * What stayed: the section list above and every word of why it is that short,
 * the capability filter and the note that it is a courtesy rather than a gate,
 * the two session-ending actions, and the three sentences of the wall. What
 * left: a header, a nav, a column and a footer that were byte for byte the
 * sponsor's.
 */
export function ClinicChrome({
  children,
  nav,
  bare = false,
  clinicName,
  capabilities = [],
  linked = false,
}: {
  children: React.ReactNode;
  /** Signed out gets the door and no rail: every link would bounce them. */
  nav: boolean;
  bare?: boolean;
  clinicName: string | null;
  /** What this principal holds. See the note on TABS: a courtesy, not a gate. */
  capabilities?: readonly ClinicCapability[];
  /** 🔴 63.2 / C352 — whether this human also has a clinician account here. */
  linked?: boolean;
}) {
  const t = useT();

  return (
    <Desk
      tone="navy"
      nav={nav}
      bare={bare}
      home="/clinic"
      name={clinicName}
      sections={allowedGroups(capabilities).map((group) => ({
        href: group.tabs[0]!.href,
        label: t(group.key),
        exact: group.tabs[0]!.href === "/clinic",
        also: group.tabs.slice(1).map((tab) => tab.href),
      }))}
      actions={
        <>
          {/*
            🔴 63.2 / C352 — THE SWITCHER, and it is a handover rather than a link.

            A therapist who upgraded is a clinician AND the practice's admin. The
            two principals have separate cookies, which means both could be live
            at once unless something ends one of them: pressing this revokes
            every clinic session this person holds and then signs them in as the
            clinician, in that order, audited.
          */}
          {linked ? (
            <form action={switchToClinician}>
              <button type="submit" title={t("clinic.switchToClinician")} className={DESK_ACTION}>
                <Stethoscope className="h-4 w-4 shrink-0" aria-hidden />
                <span className={DESK_LABEL}>{t("clinic.switchToClinician")}</span>
              </button>
            </form>
          ) : null}

          <form action={signOutClinic}>
            <button type="submit" title={t("clinic.signOut")} className={DESK_ACTION}>
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              <span className={DESK_LABEL}>{t("clinic.signOut")}</span>
            </button>
          </form>
        </>
      }
      never={{
        label: t("clinic.neverLabel"),
        items: [
          t("clinic.neverNote"),
          t("clinic.neverRisk"),
          t("clinic.neverContact"),
          t("clinic.neverBuilt"),
        ],
      }}
    >
      {nav ? <ClinicTabs capabilities={capabilities} /> : null}
      {children}
    </Desk>
  );
}
