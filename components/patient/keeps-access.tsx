"use client";

import { BeforeAfter } from "@/components/visual/primitives";
import { useT } from "@/lib/i18n/client";

/**
 * 🔴 65.4 / 65.5 — "DOES YOUR THERAPIST KEEP ACCESS?", BUILT ONCE AND USED TWICE.
 *
 * The same decision appears on the claim flow and on the invite flow, and it had a
 * paragraph of its own on each: 65 words between them, both describing only the OFF
 * state and leaving the reader to infer the ON one.
 *
 * ## 🔴 A CHECKBOX HAS TWO OUTCOMES AND BOTH ARE ON THE SCREEN
 *
 * `BeforeAfter` is the right primitive for exactly this reason. The old copy said what
 * happens if you leave it off; a person deciding needs to know what happens either way,
 * and reading one state and guessing the other is how somebody ticks a box meaning the
 * opposite of what they wanted.
 *
 * ## 🔴 65.23 — AND IT IS BESIDE THE CONTROL, NOT BEHIND IT
 *
 * Not a tooltip on the label and not a sentence after the submit. Consent is the thing
 * this product is most careful about, and the consequence of a consent control is
 * visible at the moment of choosing or it did not happen.
 */
export function KeepsAccess({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const t = useT();

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
        />
        <span className="min-w-0 text-sm font-medium text-slate-800">{label}</span>
      </label>

      <div className="mt-3">
        <BeforeAfter
          beforeLabel={t("pkeep.off")}
          before={t("pkeep.offKeeps")}
          afterLabel={t("pkeep.on")}
          after={t("pkeep.onKeeps")}
        />
      </div>

      <p className="mt-2 text-xs text-slate-500">{t("pkeep.change")}</p>
    </div>
  );
}
