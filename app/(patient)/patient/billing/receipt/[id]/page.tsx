import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PatientBack } from "@/components/patient/back";
import { PrintButton } from "@/components/patient/print-button";
import { receiptFor } from "@/lib/data/receipts";
import { BRAND } from "@/lib/brand";
import { LOCALE_NAMES, dirFor, isLocale, localeTag, type Locale } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { stringsFor } from "@/lib/i18n/strings";
import { formatMoney } from "@/lib/billing/plans";
import { requirePatient } from "@/lib/patient-auth/guard";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/utils";

/** K21: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.receipt"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 Task 40: A PRINTABLE RECEIPT FOR ONE PAYMENT, IN ENGLISH OR ARABIC.
 *
 * Only the paying patient opens it: `receiptFor` asks by their person in the
 * WHERE, and anything else is a 404, the same as a receipt that does not
 * exist. It is a receipt for a payment and says so; the tax invoice, when
 * there is one, is the ETA document (ruling 4). Printing, or saving as PDF
 * from the print dialog, is the download.
 *
 * `?lang=ar` or `?lang=en` prints it in the other language whatever the app
 * is set to, because the person it is shown to (an employer, an insurer) may
 * not read the patient's.
 */
export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const actor = await requirePatient();
  const { id } = await params;
  const { lang } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const receipt = await receiptFor(actor.personId, id);
  if (!receipt) notFound();

  const reader = await getI18n();
  const locale: Locale = isLocale(lang) ? lang : reader.locale;
  const { t } = await stringsFor(locale);
  const tag = localeTag(locale);
  const other: Locale = locale === "ar" ? "en" : "ar";
  const money = (cents: number, currency = receipt.currency) => formatMoney(cents, currency, tag);
  const agent = (await getSettings()).rules.tax.sellerModel === "agent";

  return (
    <main dir={dirFor(locale)} lang={locale} className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6 print:max-w-none print:p-0">
      <style>{"@media print { nav, header, [data-print-hide] { display: none !important; } body { background: #fff; } }"}</style>

      <div data-print-hide className="flex items-center justify-between gap-3 print:hidden">
        <PatientBack />
        <div className="flex items-center gap-3">
          <Link href={`/patient/billing/receipt/${receipt.paymentId}?lang=${other}`} className="text-sm text-navy-400 underline">
            {LOCALE_NAMES[other]}
          </Link>
          <PrintButton label={t("preceipt.print")} />
        </div>
      </div>

      <article className="rounded-2xl border border-navy-100 bg-white p-5 print:border-0">
        <header className="flex items-start justify-between gap-3 border-b border-navy-100 pb-3">
          <div>
            <p className="text-lg font-bold text-navy-700">{BRAND}</p>
            <h1 className="text-sm font-semibold text-navy-600">{t("preceipt.title")}</h1>
          </div>
          {receipt.refunded ? (
            <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-400">
              {t("preceipt.refunded")}
            </span>
          ) : null}
        </header>

        <dl className="mt-3 space-y-1.5 text-sm">
          <Line label={t("preceipt.number")}>{receipt.number}</Line>
          <Line label={t("preceipt.date")}>{formatDate(receipt.paidAt, actor.timezone, locale)}</Line>
          <Line label={t("preceipt.paidBy")}>{[actor.firstName, actor.lastName].filter(Boolean).join(" ")}</Line>
          <Line label={t("preceipt.for")}>
            {t("preceipt.session", {
              name: receipt.therapistName,
              date: formatDate(receipt.sessionAt, actor.timezone, locale),
            })}
          </Line>
          {receipt.method ? (
            <Line label={t("preceipt.method")}>
              {receipt.method.kind === "transfer"
                ? t("preceipt.methodTransfer")
                : receipt.method.last4
                  ? t("preceipt.methodCardEnding", { last4: receipt.method.last4 })
                  : t("preceipt.methodCard")}
            </Line>
          ) : null}
        </dl>

        <dl className="mt-4 space-y-1.5 border-t border-navy-100 pt-3 text-sm tabular-nums">
          <Line label={t("preceipt.sessionPrice")}>{money(receipt.priceCents)}</Line>
          {receipt.coveredCents > 0 ? (
            <Line label={t("preceipt.covered")}>{`-${money(receipt.coveredCents)}`}</Line>
          ) : null}
          {receipt.vatCents > 0 ? <Line label={t("preceipt.vat")}>{money(receipt.vatCents)}</Line> : null}
          {receipt.cardFeeCents > 0 ? (
            <Line label={t("pay.cardFee")}>{money(receipt.cardFeeCents)}</Line>
          ) : null}
          <div className="flex items-baseline justify-between gap-3 border-t border-navy-100 pt-2 font-semibold text-navy-700">
            <dt>{t("preceipt.total")}</dt>
            <dd>{money(receipt.totalCents)}</dd>
          </div>
          {receipt.charged && receipt.charged.currency.toLowerCase() !== receipt.currency.toLowerCase() ? (
            <Line label={t("preceipt.charged")}>{money(receipt.charged.minor, receipt.charged.currency.toUpperCase())}</Line>
          ) : null}
        </dl>

        <p className="mt-4 text-xs text-navy-400">
          {agent ? t("preceipt.agent", { name: receipt.therapistName }) : t("preceipt.principal")}
        </p>
        <p className="mt-1 text-xs text-navy-400">{t("preceipt.notInvoice")}</p>
      </article>
    </main>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-navy-400">{label}</dt>
      <dd className="text-end text-navy-700">{children}</dd>
    </div>
  );
}
