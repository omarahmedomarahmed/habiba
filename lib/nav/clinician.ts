import {
  CalendarClock,
  CalendarDays,
  CreditCard,
  FileText,
  Home,
  KeyRound,
  LifeBuoy,
  MessageSquare,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
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
export const OPEN_TO_UNVERIFIED = ["/onboarding", "/settings", "/billing", "/earnings", "/support"];

const CLEARED: readonly Destination[] = [
  { href: "/dashboard", label: "portal.nav.home", icon: Home, primary: true },
  { href: "/sessions", label: "portal.nav.sessions", icon: CalendarDays, primary: true },
  /*
   * 51.7 — the calendar, beside the sessions it fills. Separate from /sessions
   * on purpose: that page is what HAS happened and what is about to, this one
   * is the hours nobody has taken yet.
   */
  { href: "/bookings", label: "portal.nav.bookings", icon: CalendarClock },
  { href: "/patients", label: "portal.nav.patients", icon: Users, primary: true },
  { href: "/notes", label: "portal.nav.notes", icon: FileText, hint: "portal.nav.hintNotes" },
  {
    href: "/copilot",
    label: "portal.nav.copilot",
    icon: MessageSquare,
    hint: "portal.nav.hintCopilot",
  },
  /*
   * Named for what it is *not* allowed to see, because the two copilots are
   * one tap apart and a clinician who asks the wrong one gets a refusal
   * instead of an answer.
   */
  {
    href: "/assistant",
    label: "portal.nav.assistant",
    icon: Sparkles,
    hint: "portal.nav.hintAssistant",
  },
  /* 27.2 / 27.7 — the two things a patient starts and a clinician answers. */
  { href: "/connect", label: "portal.nav.connect", icon: KeyRound, hint: "portal.nav.hintConnect" },
  { href: "/on-call", label: "portal.nav.crisisRadar", icon: Radio, hint: "portal.nav.hintRadar" },
];

/* Reachable before and after approval, in this order, on both screens. */
const ALWAYS: readonly Destination[] = [
  { href: "/earnings", label: "portal.nav.earnings", icon: Wallet, hint: "portal.nav.hintEarnings" },
  { href: "/billing", label: "portal.nav.billing", icon: CreditCard, hint: "portal.nav.hintBilling" },
  { href: "/settings", label: "portal.nav.settings", icon: Settings, hint: "portal.nav.hintSettings" },
  { href: "/support", label: "portal.support.title", icon: LifeBuoy },
];

/**
 * The list for this clinician. Nothing gated is listed until they are cleared:
 * a link into a gated page is a client-side navigation, and the shell's
 * redirect for those renders a blank document rather than the onboarding page.
 */
export function destinationsFor(cleared: boolean): readonly Destination[] {
  if (cleared) return [...CLEARED, ...ALWAYS];
  return [
    {
      href: "/onboarding",
      label: "portal.nav.finishVerification",
      short: "portal.nav.verify",
      icon: ShieldCheck,
      primary: true,
    },
    ...ALWAYS,
  ];
}
