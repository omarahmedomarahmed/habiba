import type { Metadata } from "next";

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
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("verify.title")}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("verify.body")}</p>

      {/*
        🔴 B34: THE FORM STAYS IN THE READER'S LANGUAGE. It posted to a bare
        `/verify`, so an Arabic reader who pressed Check was answered in
        English: the language comes from the path, and the path had lost it.
      */}
      <form action={localisedPath("/verify", locale)} className="mt-6 flex flex-wrap gap-2">
        <input
          type="text"
          name="code"
          defaultValue={entered}
          placeholder="XXXX-XXXX-XXXX"
          aria-label={t("verify.codeLabel")}
          className="h-12 min-w-[14rem] flex-1 rounded-xl border border-slate-200 px-3.5 font-mono tracking-widest text-slate-900 uppercase outline-none focus:border-brand-400"
        />
        <button
          type="submit"
          className="h-12 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-navy-600"
        >
          {t("verify.check")}
        </button>
      </form>

      {result ? (
        result.known ? (
          <Card className="mt-6 p-5">
            <p className="text-sm font-semibold text-slate-900">{t("verify.known")}</p>
            <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-slate-600">{t("verify.producedOn")}</dt>
              <dd className="text-slate-800">{formatDate(result.issuedAt, "UTC", locale)}</dd>
              <dt className="text-slate-600">{t("verify.sessions")}</dt>
              <dd className="text-slate-800">{result.sessions}</dd>
              <dt className="text-slate-600">{t("verify.signedNotes")}</dt>
              <dd className="text-slate-800">{result.signedNotes}</dd>
              <dt className="text-slate-600">{t("verify.summaries")}</dt>
              <dd className="text-slate-800">{result.summaryVersions}</dd>
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">{t("verify.limits")}</p>
          </Card>
        ) : (
          <Card className="mt-6 p-5">
            <p className="text-sm font-semibold text-slate-900">{t("verify.unknown")}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t("verify.unknownBody")}</p>
          </Card>
        )
      ) : null}
    </div>
  );
}
