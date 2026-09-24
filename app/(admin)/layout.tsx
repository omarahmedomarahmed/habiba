import Link from "next/link";
import {
  ArrowLeftRight,
  Banknote,
  Building2,
  FileEdit,
  Languages,
  LifeBuoy,
  PhoneCall,
  Globe2,
  HeartPulse,
  Hospital,
  PauseCircle,
  Plug,
  LayoutDashboard,
  Radio,
  Star,
  Megaphone,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  UserCog,
  Vault,
  Gauge,
  TriangleAlert,
  LineChart,
  Wallet,
} from "lucide-react";

import { landingFor, mayOpen } from "@/lib/admin/access";
import { requireStaff } from "@/lib/auth/guard";
import { cookies } from "next/headers";
import { CurrencySwitch } from "@/components/admin/currency-switch";
import { MoneyDisplayProvider } from "@/components/money/display";
import { ADMIN_CURRENCY_COOKIE, adminCurrencyFrom } from "@/lib/money/admin-currency";
import { getI18n } from "@/lib/i18n/server";
import { openChanges } from "@/lib/data/phone-change";
import { ticketCounts } from "@/lib/data/support";
import { countOpenReports } from "@/lib/data/radar-admin";
import { pendingReviewCount } from "@/lib/data/verification";
import { waitingCount } from "@/lib/billing/manual";
import { LanguageCorner } from "@/components/i18n/language-corner";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  /*
   * 20.8 — the shell admits the back office; each page still decides for itself.
   *
   * Staff work the queues, managers also see how the queues are doing, and
   * super_admins additionally hold the settings that price the product. This
   * is defence in depth rather than the only check: every page below calls its
   * own guard, and the nav is filtered by role so nobody is shown a door that
   * will bounce them.
   */
  const actor = await requireStaff();
  /*
   * W2-A01: every nav label is a MessageKey now. The nav became a list the
   * role table filters, and a label moved into that list would have left the
   * prose and i18n ratchets' sight while still being read, so they were keyed
   * rather than hidden.
   */
  const { t } = await getI18n();

  const [waiting, reports, tickets, changes, transfers] = await Promise.all([
    pendingReviewCount(),
    countOpenReports(),
    ticketCounts(),
    openChanges(200).then((rows) => rows.length),
    waitingCount(),
  ]);

  /*
   * 🔴 W2-A01 / A5: the nav is the role table, filtered. It used to decide
   * who saw each link with two booleans of its own while each page decided who
   * got in with its own guard, and six links were shown to roles the page then
   * bounced. `lib/admin/access.ts` is the one list, and
   * `tests/admin-access.test.ts` fails when a page's guard disagrees with it.
   */
  const nav: NavItem[] = [
    { href: "/admin", icon: LayoutDashboard, label: t("anav.overview") },
    /* 🔴 20.18 / 20.24: two support queues, never one list. */
    { href: "/admin/support", icon: LifeBuoy, label: t("anav.support"), count: tickets.open + tickets.waiting },
    { href: "/admin/numbers", icon: PhoneCall, label: t("anav.numbers"), count: changes },
    { href: "/admin/therapists", icon: Users, label: t("anav.clinicians") },
    { href: "/admin/verifications", icon: ShieldCheck, label: t("anav.verifications"), count: waiting },
    { href: "/admin/radar", icon: Radio, label: t("anav.radar"), count: reports, urgent: true },
    { href: "/admin/payouts", icon: Banknote, label: t("anav.payouts") },
    /*
     * 🔴 73.2: THE BADGE IS NOT DECORATION. Every number in it is a person
     * on a spinner, and several of them are waiting to join a therapy
     * session. Red rather than the muted style the other counts use,
     * because this queue is worked by the minute and the others are not.
     */
    { href: "/admin/transfers", icon: ArrowLeftRight, label: t("anav.transfers"), count: transfers, urgent: true },
    { href: "/admin/ratings", icon: Star, label: t("anav.ratings") },
    { href: "/admin/vault", icon: Vault, label: t("anav.vault") },
    /*
     * 53.6: the owner's, like every other money door. Activating a sponsor
     * opens a corporate account and opening a pot commits us to refund terms.
     */
    { href: "/admin/sponsors", icon: Building2, label: t("asponsor.nav") },
    /*
     * 🔴 C247: the pause is "a real and unfair outcome" and must be
     * "reversible by us in one step". A door beside the sponsors one,
     * because it is the same authority: lifting a pause restarts an
     * employer's funding without the proof the cycle exists to collect.
     */
    { href: "/admin/benefits", icon: PauseCircle, label: t("anav.benefits") },
    /*
     * 54.3: activating a clinic opens an organisation that will hold
     * clinical records, a strictly larger act than activating a sponsor.
     */
    { href: "/admin/clinics", icon: Hospital, label: t("aclinic.nav") },
    /*
     * 55.2: activating a partner lets them hold a key, and an employment key
     * is an identity oracle pointed at our own patients (C265).
     */
    { href: "/admin/partners", icon: Plug, label: t("apartner.nav") },
    /* 44.1: C97: the mute rate beside the threshold that halts the channel. */
    { href: "/admin/checkins", icon: HeartPulse, label: t("acheckin.nav") },
    { href: "/admin/taxonomy", icon: Globe2, label: t("anav.taxonomy") },
    { href: "/admin/announce", icon: Megaphone, label: t("anav.announce") },
    { href: "/admin/content", icon: FileEdit, label: t("anav.content") },
    { href: "/admin/settings", icon: SlidersHorizontal, label: t("anav.settings") },
    /* W2-A06: who can open the console, invited by link. */
    { href: "/admin/team", icon: UserCog, label: t("anav.team") },
    { href: "/admin/strings", icon: Languages, label: t("anav.strings") },
    { href: "/admin/audit", icon: ScrollText, label: t("anav.audit") },
    /*
     * 🔴 58.3: two pages that existed, worked, and were reachable only by
     * typing the URL. `verify:reachable` found both on its first run.
     */
    { href: "/admin/usage", icon: Gauge, label: t("anav.usage") },
    { href: "/admin/errors", icon: TriangleAlert, label: t("anav.errors") },
    /*
     * 🔴 76.53: the company's own result and payroll are a board pack. The
     * 24/7 team works queues.
     */
    { href: "/admin/financial-model", icon: LineChart, label: t("anav.model") },
    { href: "/admin/actuals", icon: Wallet, label: t("anav.actuals") },
  ];

  /* The console leads with dollars, or pounds if this operator switched. Nobody else's screen changes. */
  const currency = adminCurrencyFrom((await cookies()).get(ADMIN_CURRENCY_COOKIE)?.value);

  return (
    <MoneyDisplayProvider primary={currency}>
    <div className="min-h-dvh">
      {/* 🔴 75.3 — the language switch, in the same corner of every screen. */}
      <LanguageCorner />
      <header className="border-b border-slate-200 bg-navy-500">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href={landingFor(actor.role)} className="text-[15px] font-bold tracking-tight text-white">
            24Therapy <span className="font-normal text-white/50">admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <CurrencySwitch current={currency} />
            <Link href="/dashboard" className="text-xs font-medium text-white/70 hover:text-white">
              Back to portal
            </Link>
          </div>
        </div>

        {/*
          🔴 37R.25 / C188 — sixteen destinations, and five of them were off
          the screen on a laptop.

          The row was `max-w-5xl` with `overflow-x-auto` and `no-scrollbar`, so
          at 1440px it clipped mid-word after "Radar lists" and showed nothing
          to say there was more: Announce, Site content, Settings, Strings and
          the Audit log simply did not appear, and nothing in the console links
          to them from anywhere else. It wraps now — a console is a tool, and a
          tool that hides a third of itself to stay on one line is the wrong
          trade. The horizontal scroll stays for phones, where wrapping sixteen
          items would push the page down instead.
        */}
        <nav aria-label="Admin" className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2 sm:px-5 lg:flex-wrap lg:overflow-x-visible">
          {nav
            .filter((item) => mayOpen(actor.role, item.href))
            .map((item) => (
              <AdminLink key={item.href} href={item.href} icon={item.icon}>
                {item.label}
                {item.count ? (
                  <span
                    className={
                      item.urgent
                        ? "ms-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white"
                        : "ms-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-navy-600"
                    }
                  >
                    {item.count}
                  </span>
                ) : null}
              </AdminLink>
            ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
    </MoneyDisplayProvider>
  );
}

type NavItem = {
  href: string;
  icon: typeof Users;
  label: React.ReactNode;
  count?: number;
  /** Red rather than amber: a queue worked by the minute. */
  urgent?: boolean;
};

function AdminLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="tap-target flex shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
    </Link>
  );
}
