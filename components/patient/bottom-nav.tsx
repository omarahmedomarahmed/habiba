"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, CircleUser, Globe2, Home, Users, Video } from "lucide-react";

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
 * Home, Sessions, the globe, Therapists, You. Everything else lives inside one
 * of those. A patient app with a "more" tab is one where the thing somebody
 * needs is always in the drawer.
 *
 * ## 🔴 THIS IS OPTION A, CHOSEN. /design/patient/sample
 *
 * Three shells were drawn and compared, and this is the one. What changed from
 * what was here before, and why:
 *
 *   `/patient` was labelled "Sessions" and is a HOME screen. It carries a
 *   greeting, a search, who is free now, an explore rail, categories, the
 *   highest rated and the record card. The bar has said Sessions since it was
 *   written, so the first tab named the wrong screen and the actual session
 *   list at `/patient/sessions` had no tab at all.
 *
 *   Therapists takes Billing's place. Option A's whole bet is that finding
 *   somebody is a PLACE you can browse when you are not in a hurry, not only
 *   a red button for the worst hour of the week, and a place needs a tab.
 *
 *   Steps and Billing come off. Both keep a way in, which is the part that
 *   cannot be skipped: Steps is a row on Home, and Billing is a row on You.
 *   Taking a destination off the bar without giving it a home is exactly the
 *   drawer this comment has always warned about.
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
  { href: "/patient", key: "tab.home", icon: Home },
  { href: "/patient/sessions", key: "tab.sessions", icon: CalendarDays },
] as const;

const RIGHT = [
  { href: "/patient/browse", key: "tab.therapists", icon: Users },
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
      {/*
        🔴 THE THERAPIST PORTAL'S DOCK, WITH THE PATIENT'S FIVE (founder, 26 Sep).

        The same floating navy bar the clinician gets on a phone
        (`components/nav/bottom-nav.tsx`): inset from the edges, rounded, a
        raised teal centre, teal-on-glass for the current page. It floats, so
        `safe-bottom` pads under it for the home indicator and the page keeps
        its `pb-24` in `chrome.tsx`. The session orb (`bottom-24`) and the SOS
        orb both sit above it and stay pressable.
      */}
      <nav
        aria-label={t("tab.sections")}
        /* The SOS orb measures this and never rests or drags below its top edge. */
        data-bottom-nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 px-3"
      >
        <ul className="mx-auto flex max-w-lg items-center justify-around gap-0.5 rounded-[26px] bg-navy-900/95 px-2 py-1 shadow-[0_20px_40px_-16px_rgba(3,11,23,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
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

          <li className="flex shrink-0 justify-center px-1">
            <Link
              href="/patient/radar"
              aria-label={t("tab.radar")}
              aria-current={on("/patient/radar") ? "page" : undefined}
              onClick={intercept ? (event) => intercept(event, "/patient/radar") : undefined}
              className="tap-target -mt-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-navy-700 shadow-[0_10px_28px_-8px_rgba(46,196,182,0.9)] ring-4 ring-navy-50 transition-[background-color,transform] hover:bg-brand-400 active:scale-95 active:bg-brand-600"
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
        <div className="fixed inset-0 z-[60] flex items-end bg-navy-900/45 p-3 backdrop-blur-[2px]">
          <div className="mx-auto w-full max-w-md rounded-[28px] bg-white p-5 shadow-[0_-20px_60px_-20px_rgba(3,11,23,0.45)]">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-navy-200" aria-hidden />
            <p className="text-[19px] font-bold tracking-tight text-navy-700">
              {t("tab.leaveTitle")}
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-navy-400">
              {t("tab.leaveBody")}
            </p>
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => setLeavingTo(null)}
                className="tap-target h-12 flex-1 rounded-2xl bg-brand-500 px-4 text-[15px] font-semibold text-navy-700"
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
                className="tap-target h-12 flex-1 rounded-2xl border border-navy-200 bg-white px-4 text-[15px] font-semibold text-navy-600"
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
    <li className="min-w-0 flex-1">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={onClick ? (event) => onClick(event, href) : undefined}
        className={cn(
          "tap-target my-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[11px] transition-colors",
          tone === "live"
            ? "bg-red-600 font-semibold text-white"
            : active
              ? "bg-white/10 font-semibold text-brand-300"
              : "font-medium text-white/70 hover:text-white",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
        <span className="max-w-full truncate">{label}</span>
      </Link>
    </li>
  );
}
