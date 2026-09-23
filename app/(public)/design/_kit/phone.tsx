import type { ReactNode } from "react";
import { Bell, ChevronLeft, FileText, Home, LifeBuoy, User, Users } from "lucide-react";

import { cn } from "@/lib/utils";

import { tx, type Lang } from "./tx";

/**
 * The patient app's shell, redrawn. One frame, exactly 390 CSS pixels wide,
 * because 390 is the width the assessment measured every defect at.
 *
 * Three decisions live here rather than on any one screen:
 *
 * 1. SOS IS PART OF THE BOTTOM BAR, NOT A FLOATING ORB. The draggable orb at
 *    62% of the height landed on the password field, the journal box and the
 *    main button of the therapist page, and the booking sheet was drawn over
 *    it (takeover/assess/patient.md). In the bar it covers nothing, and every
 *    sheet opens ABOVE the bar, so nothing can cover it either: P5 by layout,
 *    not by z-index.
 * 2. THE NEXT-STEP BAR replaces the session orb. Money owed or a door open
 *    shows on every screen, in words, just above the bar (P2). Amber is money,
 *    brand is a door.
 * 3. THE INBOX HAS A DOOR. A bell in the top bar with a count; every message
 *    we send also lands there, so nothing lives only in an email (P2).
 */
export type Tab = "home" | "therapists" | "record" | "me";

export type NextStep =
  | { kind: "owed"; text: string; action: string }
  | { kind: "ready"; text: string; action: string };

export function Phone({
  lang,
  title,
  back = false,
  inbox = 0,
  tab,
  next,
  sheet,
  dim = false,
  chrome = true,
  children,
}: {
  lang: Lang;
  title?: string;
  back?: boolean;
  inbox?: number;
  tab?: Tab;
  next?: NextStep;
  /** A sheet opens above the bottom bar, never over SOS. */
  sheet?: ReactNode;
  dim?: boolean;
  /** Off for screens outside the signed-in app (a join link, a payment page). */
  chrome?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      lang={lang}
      className="relative flex h-[780px] w-[390px] shrink-0 flex-col overflow-hidden rounded-[28px] border border-navy-200 bg-navy-50 text-navy-500 shadow-sm"
    >
      {title !== undefined ? (
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-navy-100 bg-white px-4">
          {back ? <ChevronLeft className="h-5 w-5 text-navy-500 rtl:rotate-180" aria-hidden /> : null}
          <p className="flex-1 truncate text-[17px] font-semibold">{title}</p>
          {chrome ? (
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full">
              <Bell className="h-5 w-5" aria-hidden />
              {inbox > 0 ? (
                <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-navy-500 px-1 text-[11px] font-bold text-white">
                  {inbox}
                </span>
              ) : null}
            </span>
          ) : null}
        </header>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full flex-col gap-3 overflow-hidden p-4">{children}</div>
        {dim ? <div className="absolute inset-0 bg-navy-900/40" /> : null}
        {sheet ? (
          <div className="absolute inset-x-0 bottom-0 max-h-[92%] overflow-hidden rounded-t-3xl bg-white p-5 shadow-[0_-8px_30px_rgba(3,11,23,0.18)]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-navy-200" />
            {sheet}
          </div>
        ) : null}
      </div>

      {chrome && next ? <NextBar step={next} /> : null}
      {chrome ? <BottomBar lang={lang} tab={tab} /> : null}
    </div>
  );
}

function NextBar({ step }: { step: NextStep }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 px-4 py-2.5",
        step.kind === "owed" ? "bg-amber-400 text-navy-600" : "bg-brand-500 text-navy-600",
      )}
    >
      <p className="flex-1 text-[15px] font-semibold">{step.text}</p>
      <span className="rounded-full bg-navy-600 px-3.5 py-1.5 text-[14px] font-semibold text-white">
        {step.action}
      </span>
    </div>
  );
}

function BottomBar({ lang, tab }: { lang: Lang; tab?: Tab }) {
  const items: Array<{ id: Tab; label: string; icon: ReactNode }> = [
    { id: "home", label: tx(lang, "Home", "الرئيسية"), icon: <Home className="h-5 w-5" aria-hidden /> },
    { id: "therapists", label: tx(lang, "Therapists", "المعالجون"), icon: <Users className="h-5 w-5" aria-hidden /> },
    { id: "record", label: tx(lang, "Record", "سجلّي"), icon: <FileText className="h-5 w-5" aria-hidden /> },
    { id: "me", label: tx(lang, "Me", "حسابي"), icon: <User className="h-5 w-5" aria-hidden /> },
  ];
  return (
    <nav className="flex h-16 shrink-0 items-stretch border-t border-navy-100 bg-white">
      {items.map((item) => (
        <span
          key={item.id}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-medium",
            tab === item.id ? "text-navy-600" : "text-navy-400",
          )}
        >
          {item.icon}
          {item.label}
          {tab === item.id ? <span className="mt-0.5 h-1 w-1 rounded-full bg-navy-600" /> : null}
        </span>
      ))}
      <span className="flex w-[76px] items-center justify-center">
        <span className="flex h-12 w-14 flex-col items-center justify-center rounded-2xl bg-red-600 text-[11px] font-bold text-white">
          <LifeBuoy className="h-5 w-5" aria-hidden />
          {tx(lang, "SOS", "طوارئ")}
        </span>
      </span>
    </nav>
  );
}
