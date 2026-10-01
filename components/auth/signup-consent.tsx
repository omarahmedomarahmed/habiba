"use client";

import Link from "next/link";

import { useT } from "@/lib/i18n/client";

/**
 * The layered notice above Create account. Due diligence F3 and F11.
 *
 * Layer one is here, on the form: who handles the data, for what, and where, in
 * four short lines. Layer two is the privacy notice and terms, linked from the
 * same box. The boxes are `required`, so a browser will not send the form
 * without them, and the server checks them again (`signupConsentProblem`)
 * because a form is only a suggestion to anything that is not a browser.
 *
 * The version the person accepted and the instant they did are stored on the
 * account (`lib/consent/terms.ts`).
 */
export function SignupConsent({ audience }: { audience: "patient" | "clinician" }) {
  const t = useT();

  const link = (href: string, word: string) => (
    <Link href={href} target="_blank" className="font-medium underline">
      {word}
    </Link>
  );
  const more = t("signupConsent.more")
    .split(/(\{privacy\}|\{terms\})/g)
    .map((part, index) =>
      part === "{privacy}" ? (
        <span key={index}>{link("/privacy", t("signupConsent.privacyWord"))}</span>
      ) : part === "{terms}" ? (
        <span key={index}>{link("/terms", t("signupConsent.termsWord"))}</span>
      ) : (
        <span key={index}>{part}</span>
      ),
    );

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
      <p className="text-xs font-semibold text-slate-800">{t("signupConsent.lead")}</p>
      <ul className="list-disc space-y-1 ps-4 text-xs leading-relaxed text-slate-600">
        <li>{t("signupConsent.openai")}</li>
        <li>{t("signupConsent.daily")}</li>
        <li>{t("signupConsent.resend")}</li>
        <li>{t("signupConsent.hosting")}</li>
      </ul>
      <p className="text-xs leading-relaxed text-slate-600">{more}</p>

      {audience === "patient" ? (
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input type="checkbox" name="adult" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("signupConsent.adult")}</span>
        </label>
      ) : null}
      <label className="flex items-start gap-2 text-sm text-slate-800">
        <input type="checkbox" name="terms" required className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {audience === "patient" ? t("signupConsent.accept") : t("signupConsent.acceptClinician")}
        </span>
      </label>
    </div>
  );
}
