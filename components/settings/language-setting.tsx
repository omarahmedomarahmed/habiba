import { Card } from "@/components/ui";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

import { LanguageSave } from "./language-save";

/**
 * 🔴 0169 / RULING 8: the language this person reads in, and every message we
 * send them. A plain form, no JavaScript: it works on the phones this product
 * is used on. Each language is named in itself (`LOCALE_NAMES`).
 */
export async function LanguageSetting({
  action,
  saved,
  justSaved = false,
}: {
  action: (formData: FormData) => Promise<void>;
  /** What they chose, or null when they never did. */
  saved: Locale | null;
  /**
   * B55: the action redirects back with `?lang=saved`, and the page passes it
   * here. Still no JavaScript: the confirmation is part of the next render.
   */
  justSaved?: boolean;
}) {
  const { t, locale } = await getI18n();
  const current = saved ?? locale;
  return (
    <Card className="p-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm">
          <span className="block font-semibold text-slate-900">{t("lang.title")}</span>
          <span className="block text-xs text-slate-500">{t("lang.body")}</span>
          <select
            name="locale"
            defaultValue={current}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
          >
            {LOCALES.map((code) => (
              <option key={code} value={code} lang={code}>
                {LOCALE_NAMES[code]}
              </option>
            ))}
          </select>
        </label>
        <LanguageSave />
      </form>
      {justSaved ? (
        <p role="status" className="mt-2 text-sm font-medium text-emerald-700">
          {t("lang.saved")}
        </p>
      ) : null}
    </Card>
  );
}
