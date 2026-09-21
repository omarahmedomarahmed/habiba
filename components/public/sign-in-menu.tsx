"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui";
import { doors } from "@/lib/auth/doors";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * The four doors, behind one button. Task 153.
 *
 * ## Why this is a menu and not a link
 *
 * There are six ways into this product and they live in five route groups:
 * `/login` for a clinician, `/patient/login`, `/sponsor/sign-in`,
 * `/clinic/sign-in`, `/partner/sign-in` and `/staff/sign-in`. A header with a
 * single "Sign in" link has to pick one of them, and it picked the clinician's.
 * So a covered employee who arrived from their HR email, and a clinic owner who
 * had just read `/for-clinics`, both landed on a page headed "your practice"
 * and had no route from the marketing site to their own portal at all.
 *
 * Asking is one press longer than guessing and right every time.
 *
 * The list itself is `lib/auth/doors.ts`, so the auth pages' switcher and this
 * cannot drift apart. See the note there for why two of the four lead to an
 * enquiry rather than a signup form.
 *
 * ## 🔴 The staff door is not in here, and must not be
 *
 * `verify:sprint21r` asserts that nothing on the public site links to
 * `/staff/sign-in`, and the note on that page says why: a console that can
 * suspend a clinician should not be one tab from the marketing homepage for
 * somebody who has never worked here. A menu offering every door is exactly
 * the helpful shortcut that rule exists to stop. Partner is out for the same
 * reason. Both are reached by URL, by people who have one.
 */

export function SignInMenu({ className }: { className?: string }) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  const first = React.useRef<HTMLAnchorElement>(null);

  /*
   * Escape closes and returns focus to the button, and a press anywhere else
   * closes without stealing the press. `pointerdown` rather than `click`: a
   * click listener fires after the link under the pointer has already navigated
   * away, which on a slow connection leaves the menu open over the new page.
   */
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  /* Opening with the keyboard must land somewhere, or the menu is unusable. */
  React.useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);

  return (
    <div ref={root} className={cn("relative", className)}>
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {t("nav.signIn")}
        <svg
          viewBox="0 0 12 12"
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
          aria-hidden
        >
          <path
            d="M2.5 4.5L6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Button>

      {open ? (
        /*
         * `end-0` rather than `right-0`: in Arabic the header row reverses and a
         * menu pinned to the physical right hangs off the wrong edge of its
         * button. The logical property follows the direction.
         */
        <div
          role="menu"
          aria-label={t("nav.whichAreYou")}
          className="absolute end-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-navy-900/10"
        >
          <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("nav.whichAreYou")}
          </p>
          {doors(t, "signin").map((door, index) => (
            <Link
              key={door.key}
              ref={index === 0 ? first : undefined}
              href={door.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50 focus-visible:bg-slate-50"
            >
              <span className="block text-sm font-semibold text-navy-500">{door.label}</span>
              <span className="mt-0.5 block text-xs text-slate-600">{door.why}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
