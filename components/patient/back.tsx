"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { useT } from "@/lib/i18n/client";

/**
 * Back, on every patient screen that is not a tab. 37R.25, C185.
 *
 * ## Why it is a component and not a `<Link href="/patient">`
 *
 * Seven screens had one and four did not, and the ones that had it all pointed
 * at the same fixed parent. Fixed parents are wrong in this app more often
 * than they look: somebody who reaches their summary from the consent screen,
 * or a therapist's profile from the radar, is thrown to the home screen and
 * has to find their way back to where they were. The founder's instruction is
 * literal — back goes to the previous page — so this one does.
 *
 * ## 🔴 Why it still takes a `fallback`
 *
 * Half of this product's traffic arrives on a deep link from WhatsApp, where
 * there is no previous page inside the app. `router.back()` on a fresh tab
 * either does nothing or leaves the site, and a dead control on a screen
 * somebody opened in distress is worse than a slightly wrong destination. So
 * the component checks whether there is history to go back to and falls back
 * to the named parent when there is not.
 *
 * `window.history.length > 1` is the only signal a browser gives, and it is
 * not exact: a tab that visited one other site before this one also reports 2.
 * The cost of being wrong is one extra tap on an ordinary screen, which is the
 * cheapest possible way to be wrong here.
 */
export function PatientBack({
  fallback = "/patient",
  label,
}: {
  fallback?: string;
  /** 37L.1 — defaults to the dictionary, so "Back" is never English by accident. */
  label?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    try {
      setCanGoBack(window.history.length > 1);
    } catch {
      /* No history object is an ancient browser, not a reason to hide back. */
    }
  }, []);

  return (
    <button
      type="button"
      onClick={() => (canGoBack ? router.back() : router.push(fallback))}
      className="tap-target -ms-2 flex w-fit items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500"
    >
      {/* The arrow follows the writing direction: RTL mirrors it. */}
      <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
      {label ?? t("common.back")}
    </button>
  );
}
