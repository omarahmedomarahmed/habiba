"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";

import { setLocale } from "@/app/actions/locale";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Switch language.
 *
 * Each language is written in itself — "العربية", never "Arabic" — because a
 * reader who cannot read the current interface cannot read the word for their
 * own language in it either. That is the entire reason language pickers look
 * the way they do, and it is the thing most often got wrong.
 *
 * `router.refresh()` rather than a reload: the locale lives in a cookie read
 * on the server, so re-rendering the tree is enough, and a full reload in the
 * middle of a session would drop a patient out of a video call to change a
 * label.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (next: Locale) =>
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });

  return (
    <div
      className={cn("inline-flex items-center gap-1 rounded-full bg-slate-100 p-0.5", className)}
      role="group"
      aria-label={current === "ar" ? "اللغة" : "Language"}
    >
      <Languages className="ms-2 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={pending}
          onClick={() => choose(locale)}
          aria-pressed={locale === current}
          lang={locale}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
            locale === current
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900",
          )}
        >
          {LOCALE_NAMES[locale]}
        </button>
      ))}
    </div>
  );
}
