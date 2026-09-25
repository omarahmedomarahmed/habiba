import type { Metadata } from "next";

import { Check, ShieldCheck } from "lucide-react";

import { DarkBand, Glow } from "@/components/public/site-ui";
import { Card } from "@/components/ui";
import { verifyExtract } from "@/lib/data/export";
import { localisedPath } from "@/lib/i18n/paths";
import { getI18n } from "@/lib/i18n/server";
import { formatDate } from "@/lib/utils";

/** K21: the whole page was English; the title and description too. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("verify.metaTitle"), description: t("verify.metaDescription") };
}
export const dynamic = "force-dynamic";

/**
 * The public verification page. PLAN.md 26.9, C127.
 *
 * ## 🔴 The two sentences this page exists to keep apart
 *
 * "24Therapy produced this document" is something we can say. "The diagnosis
 * in this document is correct" is not, and the gap between them is the whole
 * ruling: a platform that lets a code resolve to a person's clinical facts has
 * written a certificate, whatever it calls itself.
 *
 * So this page answers with counts and a date and nothing else. No name, no
 * clinician, no diagnosis, not even a confirmation that the code belongs to
 * whoever is holding the paper. An unknown code and a real one that is not
 * yours look identical, deliberately.
 *
 * It is a plain GET form: somebody is typing a code off a printed page, often
 * on a desktop in an office, and there is nothing here worth a fetch.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const { t, locale } = await getI18n();
  const entered = (code ?? "").trim();
  const result = entered ? await verifyExtract(entered) : null;

  return (
    /* B34: a div, because the public layout already wraps every page in the one `<main>`. */
    <div>
      <DarkBand className="px-5 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
        <Glow className="-start-40 top-0 h-[440px] w-[440px] opacity-50" />
        <div className="mx-auto max-w-2xl">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-brand-300 ring-1 ring-white/15">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="mt-6 text-balance text-[34px] font-bold leading-[1.08] tracking-tight text-white sm:text-[48px]">
            {t("verify.title")}
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-[17px] leading-relaxed text-white/85">{t("verify.body")}</p>

      {/*
        🔴 B34: THE FORM STAYS IN THE READER'S LANGUAGE. It posted to a bare
        `/verify`, so an Arabic reader who pressed Check was answered in
        English: the language comes from the path, and the path had lost it.
      */}
      <form action={localisedPath("/verify", locale)} className="mt-8 flex flex-col gap-3 rounded-[24px] bg-white/[0.06] p-3 ring-1 ring-white/10 sm:flex-row">
        <input
          type="text"
          name="code"
          defaultValue={entered}
          placeholder="XXXX-XXXX-XXXX"
          aria-label={t("verify.codeLabel")}
          dir="ltr"
          className="h-14 min-w-0 flex-1 rounded-2xl bg-white px-4 font-mono text-[17px] tracking-widest text-navy-700 uppercase outline-none placeholder:text-navy-300 focus:ring-2 focus:ring-brand-400"
        />
        <button
          type="submit"
          className="h-14 rounded-2xl bg-brand-500 px-7 text-[16px] font-semibold text-navy-700 shadow-[0_8px_24px_-8px_rgba(46,196,182,0.7)] transition-colors hover:bg-brand-400"
        >
          {t("verify.check")}
        </button>
      </form>

      {result ? (
        result.known ? (
          <Card className="mt-6 rounded-[24px] border-0 p-6 text-navy-700">
            <p className="flex items-center gap-2 text-[17px] font-bold text-navy-700">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-navy-700">
                <Check className="h-4 w-4" aria-hidden />
              </span>
              {t("verify.known")}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div className="col-span-2 rounded-2xl bg-navy-50 p-4">
                <dt className="text-[13px] font-semibold text-navy-400">{t("verify.producedOn")}</dt>
                <dd className="mt-1 text-[18px] font-bold text-navy-700">{formatDate(result.issuedAt, "UTC", locale)}</dd>
              </div>
              <div className="rounded-2xl bg-navy-50 p-4">
                <dt className="text-[13px] font-semibold text-navy-400">{t("verify.sessions")}</dt>
                <dd className="mt-1 text-[26px] font-bold tabular-nums text-navy-700">{result.sessions}</dd>
              </div>
              <div className="rounded-2xl bg-navy-50 p-4">
                <dt className="text-[13px] font-semibold text-navy-400">{t("verify.signedNotes")}</dt>
                <dd className="mt-1 text-[26px] font-bold tabular-nums text-navy-700">{result.signedNotes}</dd>
              </div>
              <div className="col-span-2 rounded-2xl bg-navy-50 p-4">
                <dt className="text-[13px] font-semibold text-navy-400">{t("verify.summaries")}</dt>
                <dd className="mt-1 text-[26px] font-bold tabular-nums text-navy-700">{result.summaryVersions}</dd>
              </div>
            </dl>
            <p className="mt-5 border-t border-navy-100 pt-4 text-[14px] leading-relaxed text-navy-500">{t("verify.limits")}</p>
          </Card>
        ) : (
          <Card className="mt-6 rounded-[24px] border-amber-200 bg-amber-50 p-6">
            <p className="text-[17px] font-bold text-amber-900">{t("verify.unknown")}</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-amber-900">{t("verify.unknownBody")}</p>
          </Card>
        )
      ) : null}
        </div>
      </DarkBand>
    </div>
  );
}
