"use client";

import * as React from "react";
import Link from "next/link";

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
 */
export function MobileNav({
  links,
  radarHref,
}: {
  links: { href: string; label: string }[];
  radarHref: string;
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
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-navy-500 hover:bg-slate-100 sm:hidden"
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

      {open ? (
        <div className="fixed inset-0 z-50 sm:hidden">
          <button
            type="button"
            aria-label={t("nav.close")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-navy-900/40"
          />
          <div className="absolute inset-x-0 top-0 max-h-dvh overflow-y-auto rounded-b-3xl bg-white pb-6 shadow-xl">
            <div className="flex h-14 items-center justify-end px-4">
              <button
                type="button"
                aria-label={t("nav.close")}
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-navy-500 hover:bg-slate-100"
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

            <nav aria-label={t("nav.menu")} className="px-3">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-3 text-base font-semibold text-navy-500 hover:bg-slate-50"
                >
                  {link.label}
                </Link>
              ))}

              <Link
                href={radarHref}
                onClick={() => setOpen(false)}
                className={cn(
                  "mt-2 flex items-center gap-2 rounded-xl bg-navy-500 px-3 py-3.5",
                  "text-base font-semibold text-white",
                )}
              >
                <span className="live-dot h-2 w-2 rounded-full bg-brand-400" aria-hidden />
                {t("nav.openRadar")}
              </Link>

              <p className="mt-6 px-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {t("nav.whichAreYou")}
              </p>
              {doors(t, "signin").map((door) => (
                <Link
                  key={door.key}
                  href={door.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 hover:bg-slate-50"
                >
                  <span className="block text-sm font-semibold text-navy-500">{door.label}</span>
                  <span className="block text-xs text-slate-600">{door.why}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
