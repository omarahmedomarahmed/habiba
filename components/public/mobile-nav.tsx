"use client";

import * as React from "react";
import Link from "next/link";

import { LanguageSwitch } from "@/components/i18n/language-switch";
import { doors } from "@/lib/auth/doors";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * The same header, on a phone. Task 153.
 *
 * ## Why a sheet and not a dropdown
 *
 * The header now carries four audience links, a radar call to action, a sign in
 * menu of four doors and a language switch. At 390px, which is the launch
 * market's most common width, that is eleven targets in a 14px-tall row. A
 * sheet gives every one of them a full row and a thumb-sized target, and the
 * sign in doors keep their one-line explanations, which is the whole reason the
 * menu exists.
 *
 * ## Why the body scroll lock
 *
 * Without it the page behind scrolls under the sheet on iOS and the reader
 * closes the sheet onto a different part of the page than the one they left.
 *
 * ## 🔴 And the language switch is IN it
 *
 * The header hides its switch below 640px, and this sheet did not carry one,
 * so on the launch market's commonest width an Arabic reader who landed on an
 * English page had no way to change it. The same component, the same offered
 * list, the same real pathname the header passes.
 */
export function MobileNav({
  links,
  radarHref,
  offered,
  pathname,
}: {
  links: { href: string; label: string }[];
  radarHref: string;
  offered: { code: string; nativeName: string }[];
  pathname: string;
}) {
  const t = useT();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-label={t("nav.menu")}
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15 lg:hidden"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
          <path
            d="M3 6h14M3 10h14M3 14h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/*
        The mockups' menu: the whole screen, navy, every audience a large row
        the thumb cannot miss, and the radar as the one teal button.
      */}
      {open ? (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-navy-900 text-white lg:hidden">
          <div className="flex h-16 items-center justify-end px-4">
            <button
              type="button"
              aria-label={t("nav.close")}
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
                <path
                  d="M5 5l10 10M15 5L5 15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <nav aria-label={t("nav.menu")} className="px-6 pb-10">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block border-b border-white/10 py-4 text-[24px] font-bold text-white hover:text-brand-300"
              >
                {link.label}
              </Link>
            ))}

            <Link
              href={radarHref}
              onClick={() => setOpen(false)}
              className={cn(
                "mt-8 flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand-500 px-5",
                "text-[16px] font-semibold text-navy-700 shadow-[0_8px_24px_-8px_rgba(46,196,182,0.7)]",
              )}
            >
              <span className="live-dot h-2 w-2 rounded-full bg-navy-700" aria-hidden />
              {t("nav.openRadar")}
            </Link>

            <LanguageSwitch className="mt-6" tone="dark" offered={offered} pathname={pathname} />

            <p className="mt-10 text-[13px] font-bold uppercase tracking-[0.16em] text-white/60 rtl:tracking-normal">
              {t("nav.whichAreYou")}
            </p>
            <div className="mt-3 overflow-hidden rounded-3xl bg-white/[0.06] ring-1 ring-white/10">
              {doors(t, "signin").map((door) => (
                <Link
                  key={door.key}
                  href={door.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-white/10 px-4 py-3.5 last:border-0 hover:bg-white/5"
                >
                  <span className="block text-[15px] font-semibold text-white">{door.label}</span>
                  <span className="mt-0.5 block text-[13px] text-white/70">{door.why}</span>
                </Link>
              ))}
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
