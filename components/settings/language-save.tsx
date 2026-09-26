"use client";

import { useFormStatus } from "react-dom";

import { useT } from "@/lib/i18n/client";

/**
 * 🔴 Board 870: the language form's button says "Saving…" the moment it is
 * pressed. The form still works with no JavaScript (a plain POST and a
 * redirect back with `?lang=saved`); this only stops a slow first save
 * looking like a press that did nothing.
 */
export function LanguageSave() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-live="polite"
      className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white active:bg-slate-700 disabled:opacity-70"
    >
      {pending ? t("common.saving") : t("lang.save")}
    </button>
  );
}
