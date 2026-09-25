import {
  CalendarDays,
  Home,
  KeyRound,
  Radio,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

import type { MessageKey } from "@/lib/i18n/messages";

/**
 * 🔴 W2-T07: WHERE A CLINICIAN CAN GO, WRITTEN ONCE.
 *
 * The desktop sidebar and the phone bar were two hand-written lists, and they
 * drifted the way two copies always do: the calendar only on desktop, the
 * assistant and connect only on the phone, support on neither. Both now render
 * this list, so a destination added here reaches both screens and a destination
 * left out is missing from both, where somebody will notice.
 *
 * `primary` is the phone bar's first row; everything else goes in its More
 * sheet. The sidebar shows all of them in this order.
 */
export type Destination = {
  href: string;
  label: MessageKey;
  /** A few words under the label in the phone's More sheet. */
  hint?: MessageKey;
  /** A shorter label where the phone bar has room for one word. */
  short?: MessageKey;
  icon: typeof Home;
  primary?: boolean;
  /**
   * 🔴 Ruling 14b: the pages this one holds, shown as a row of tabs at the top
   * of each of them (`SectionTabs`). Fewer places in the navigation, and every
   * page still one tap from its group. The first is the group's own page.
   */
  members?: readonly { href: string; label: MessageKey }[];
};

/**
 * Pages an unverified clinician may still reach.
 *
 * Deliberately short. Settings and billing are here because Stripe onboarding
 * and reading the terms are things you should be able to do while waiting for
 * approval; everything else needs a patient, and they do not have one yet.
 *
 * 🔴 W2-T01: and support, because an applicant waiting on review is the person
 * with the most questions and was the one person who could not ask them.
 */
export const OPEN_TO_UNVERIFIED = [
  "/onboarding",
  "/settings",
  "/billing",
  "/earnings",
  "/support",
  /* 🔴 W2-T06: a billing notice reaches an applicant too. */
  "/notifications",
  /*
   * 🔴 Ruling 5e: a therapist a patient invited can enter the patient's code
   * while waiting for review. It only asks; the database grants nothing to an
   * unverified clinician (0060), and the first session waits for verification.
   */
  "/connect",
];

/*
 * 🔴 RULING 14b: FOURTEEN PLACES BECAME SIX. Today, Schedule, Patients, Money,
 * Radar, Settings. Nothing was removed: every page is a tab inside its group,
 * and `tests/clinician-nav.test.ts` proves each one is still listed.
 */
const TODAY: Destination = {
  href: "/dashboard",
  label: "portal.nav.today",
  icon: Home,
  primary: true,
  /*
   * The two assistants sit with the day, one tap apart. The second is named for
   * what it is *not* allowed to see, because a clinician who asks the wrong one
   * gets a refusal instead of an answer.
   */
  members: [
    { href: "/dashboard", label: "portal.nav.today" },
    { href: "/copilot", label: "portal.nav.copilot" },
    { href: "/assistant", label: "portal.nav.assistant" },
  ],
};

const SCHEDULE: Destination = {
  href: "/sessions",
  label: "portal.nav.schedule",
  icon: CalendarDays,
  primary: true,
  /* 51.7: the calendar beside the sessions it fills: what has happened, and the hours nobody has taken yet. */
  members: [
    { href: "/sessions", label: "portal.nav.sessions" },
    { href: "/bookings", label: "portal.nav.bookings" },
  ],
};

const PATIENTS: Destination = {
  href: "/patients",
  label: "portal.nav.patients",
  icon: Users,
  primary: true,
  /* 27.2 / 27.7: connect is the thing a patient starts and a clinician answers. */
  members: [
    { href: "/patients", label: "portal.nav.patients" },
    { href: "/notes", label: "portal.nav.notes" },
    { href: "/connect", label: "portal.nav.connect" },
  ],
};

const RADAR: Destination = { href: "/on-call", label: "portal.nav.crisisRadar", icon: Radio, hint: "portal.nav.hintRadar" };

const CLEARED: readonly Destination[] = [TODAY, SCHEDULE, PATIENTS];

/* Reachable before and after approval, in this order, on both screens. */
const MONEY: Destination = {
  href: "/earnings",
  label: "portal.nav.money",
  icon: Wallet,
  hint: "portal.nav.hintEarnings",
  members: [
    { href: "/earnings", label: "portal.nav.earnings" },
    { href: "/billing", label: "portal.nav.billing" },
  ],
};

const SETTINGS: Destination = {
  href: "/settings",
  label: "portal.nav.settings",
  icon: Settings,
  hint: "portal.nav.hintSettings",
  /* 🔴 W2-T06 and W2-T01: every notice we write for them, and a way to ask us. */
  members: [
    { href: "/settings", label: "portal.nav.settings" },
    { href: "/notifications", label: "tw2.notifications" },
    { href: "/support", label: "portal.support.title" },
  ],
};

/** Every page in the navigation, groups and their tabs, for the checks. */
export function pagesFor(cleared: boolean): string[] {
  return [...new Set(destinationsFor(cleared).flatMap((d) => [d.href, ...(d.members ?? []).map((m) => m.href)]))];
}

/** The group a path belongs to, for the tab row and for what reads as active. */
export function groupOf(pathname: string, cleared = true): Destination | null {
  const within = (href: string) => (href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  return destinationsFor(cleared).find((d) => within(d.href) || (d.members ?? []).some((m) => within(m.href))) ?? null;
}

/**
 * The list for this clinician. Nothing gated is listed until they are cleared:
 * a link into a gated page is a client-side navigation, and the shell's
 * redirect for those renders a blank document rather than the onboarding page.
 */
export function destinationsFor(cleared: boolean): readonly Destination[] {
  if (cleared) return [...CLEARED, MONEY, RADAR, SETTINGS];
  return [
    {
      href: "/onboarding",
      label: "portal.nav.finishVerification",
      short: "portal.nav.verify",
      icon: ShieldCheck,
      primary: true,
    },
    /* 🔴 Ruling 5e: the code a patient gave them, while they wait for review. */
    { href: "/connect", label: "portal.nav.connect", icon: KeyRound, hint: "portal.nav.hintConnect" },
    MONEY,
    SETTINGS,
  ];
}
