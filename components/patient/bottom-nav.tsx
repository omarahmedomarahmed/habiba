"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, CircleUser, Globe2, ListChecks, Receipt, Video } from "lucide-react";

import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * The patient's bottom navigation. PLAN.md 15.1, 25.2, 25.3, 25.4.
 *
 * ## The globe is in the centre and it is bigger
 *
 * Not decoration. The radar is the one thing on this app somebody might need
 * *urgently*, and a person in distress should not have to read five labels to
 * find it. It sits under the thumb, it is the only lifted item, and it keeps
 * its emphasis whether or not it is the current page.
 *
 * ## Five, not more
 *
 * Sessions, homework, the globe, billing, account. Everything else lives
 * inside one of those. A patient app with a "more" tab is one where the thing
 * somebody needs is always in the drawer.
 *
 * ## 🔴 25.4 / C129 — during a live session
 *
 * The nav does not disappear. Hiding it is how a patient loses the SOS orb's
 * neighbour and how a product decides on somebody's behalf that they may not
 * leave. Instead the session becomes a sixth item, locked active, and every
 * other destination asks first. The question is asked in this component rather
 * than by a `beforeunload` handler because a client-side route change never
 * fires one, and the way a patient actually wanders off is by tapping Billing.
 */
/* 37L.1 — the label is a key, resolved at render, so the bar is in the
   reader's language rather than in the language it was written in. */
const LEFT = [
  { href: "/patient", key: "tab.sessions", icon: CalendarDays },
  { href: "/patient/homework", key: "tab.steps", icon: ListChecks },
] as const;

const RIGHT = [
  { href: "/patient/billing", key: "tab.billing", icon: Receipt },
  { href: "/patient/account", key: "tab.you", icon: CircleUser },
] as const;

type Props = {
  /**
   * The session happening right now, when one is. `href` is the page the
   * patient is on, so the locked tab is a real link back to it after the
   * question below has been answered "stay".
   */
  liveSession?: { href: string } | null;
};

export function PatientBottomNav({ liveSession = null }: Props) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [leavingTo, setLeavingTo] = useState<string | null>(null);

  const on = (href: string) => {
    /* 25.4 — nothing else is the current page while a session is running. */
    if (liveSession) return false;
    return href === "/patient" ? pathname === "/patient" : pathname.startsWith(href);
  };

  /** 25.4 — a tap on anything that is not the session is a question first. */
  const intercept = liveSession
    ? (event: React.MouseEvent, href: string) => {
        event.preventDefault();
        setLeavingTo(href);
      }
    : undefined;

  return (
    <>
      <nav
        aria-label={t("tab.sections")}
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur"
      >
        <ul className="mx-auto flex max-w-md items-end justify-between px-2 py-1.5">
          {liveSession ? (
            <Item
              href={liveSession.href}
              label={t("tab.session")}
              icon={Video}
              active
              tone="live"
            />
          ) : null}

          {LEFT.map((item) => (
            <Item
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={t(item.key)}
              active={on(item.href)}
              onClick={intercept}
            />
          ))}

          <li className="-mt-5">
            <Link
              href="/patient/radar"
              aria-label={t("tab.radar")}
              onClick={intercept ? (event) => intercept(event, "/patient/radar") : undefined}
              className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 active:scale-95"
            >
              <Globe2 className="h-6 w-6" aria-hidden />
            </Link>
          </li>

          {RIGHT.map((item) => (
            <Item
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={t(item.key)}
              active={on(item.href)}
              onClick={intercept}
            />
          ))}
        </ul>
      </nav>

      {leavingTo ? (
        <div className="fixed inset-0 z-[60] flex items-end bg-slate-900/50 p-3">
          <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-5">
            <p className="text-base font-bold tracking-tight text-slate-900">
              {t("tab.leaveTitle")}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {t("tab.leaveBody")}
            </p>
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => setLeavingTo(null)}
                className="tap-target flex-1 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white"
              >
                {t("tab.stay")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const href = leavingTo;
                  setLeavingTo(null);
                  router.push(href);
                }}
                className="tap-target flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                {t("tab.leaveAnyway")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Item({
  href,
  label,
  icon: Icon,
  active,
  tone = "normal",
  onClick,
}: {
  href: string;
  label: string;
  icon: typeof CalendarDays;
  active: boolean;
  tone?: "normal" | "live";
  onClick?: (event: React.MouseEvent, href: string) => void;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={onClick ? (event) => onClick(event, href) : undefined}
        className={cn(
          "tap-target flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium",
          tone === "live" ? "text-red-600" : active ? "text-brand-600" : "text-slate-500",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
        {label}
      </Link>
    </li>
  );
}
