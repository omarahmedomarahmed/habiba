import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import { Card } from "@/components/ui";
import { Money } from "@/components/ui/money";
import { BeforeAfter } from "@/components/visual/primitives";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { patientCredits, patients, sessionPayments, sessions, users } from "@/lib/db/schema";
import { patientOwesTotal } from "@/lib/billing/manual-entry";
import { sessionDoors } from "@/lib/data/patient-view";
import { localeTag } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";
import { formatDate } from "@/lib/utils";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(patient)/patient/billing/page.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


export const metadata: Metadata = { title: "Billing", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * What a patient paid, and what it was split into. PLAN.md 15.6.
 *
 * ## Three numbers, never one
 *
 * §3 is explicit that the patient and the therapist each see the split as
 * separate lines with reasons. A single "you paid $34.20" hides that $4.20 of
 * it was tax and $4.50 was ours — and a patient who discovers either later is
 * one who stops trusting the receipt.
 *
 * ## The currency they paid in (16.4, 16.6 — closes sprint 15's caveat)
 *
 * Where a payment was presented in another currency, **that** is the headline
 * figure, at the rate frozen onto the payment when it was made. Not today's
 * rate: a receipt that changes value while somebody is reading it is not a
 * receipt. The breakdown underneath stays in the settlement currency, because
 * that is what the therapist was actually paid and what a refund would return.
 */
export default async function PatientBillingPage() {
  const actor = await requirePatient();
  const { t } = await getI18n();
  // 19.4 — the reader's language, once, on the server.
  const { locale } = await getI18n();
  const tag = localeTag(locale);

  const [paid, credits] = await Promise.all([
    db
      .select({
        sessionId: sessions.id,
        /* 🔴 Task 40: the receipt's address. */
        paymentId: sessionPayments.id,
        at: sessionPayments.paidAt,
        gross: sessionPayments.grossCents,
        vat: sessionPayments.vatCents,
        fee: sessionPayments.platformFeeCents,
        currency: sessionPayments.currency,
        presented: sessionPayments.presentedCents,
        presentedCurrency: sessionPayments.presentedCurrency,
        rateMicro: sessionPayments.fxRateMicro,
        /*
         * 🔴 53.21 / C226 — WHICH ROWS THE PATIENT DID NOT PAY FOR.
         *
         * A pot-funded session produces an ordinary `session_payments` row, which
         * is the whole point of C226 and is also how this page came to be about to
         * tell somebody they paid thirty dollars they did not pay. The funding
         * source is read so a covered session renders as covered.
         *
         * 🔴 It says "covered" and NAMES NO EMPLOYER. The employer is on no column
         * this query could reach even if it wanted one: `payer_name` is NULL on a
         * pot payment (C243) and there is no sponsor id on `session_payments`.
         */
        fundingSource: sessionPayments.fundingSource,
        patientShare: sessionPayments.patientShareCents,
        status: sessionPayments.status,
        therapistFirst: users.firstName,
        therapistLast: users.lastName,
      })
      .from(sessionPayments)
      .innerJoin(sessions, eq(sessions.id, sessionPayments.sessionId))
      .innerJoin(patients, eq(patients.id, sessions.patientId))
      .innerJoin(users, eq(users.id, sessions.therapistId))
      /*
       * Refunded ones too. A patient whose session was cancelled and refunded
       * found "Nothing paid yet" here, with no trace of the money either way
       * (live walkthrough). They are marked as refunded below.
       */
      .where(
        and(
          eq(patients.personId, actor.personId),
          inArray(sessionPayments.status, ["paid", "refunded"]),
        ),
      )
      .orderBy(desc(sessionPayments.paidAt))
      .limit(50),

    db
      .select({
        id: patientCredits.id,
        amount: patientCredits.amountCents,
        spent: patientCredits.spentCents,
        expiresAt: patientCredits.expiresAt,
      })
      .from(patientCredits)
      .where(
        and(
          eq(patientCredits.personId, actor.personId),
          gt(patientCredits.expiresAt, new Date()),
          sql`${patientCredits.spentCents} < ${patientCredits.amountCents}`,
        ),
      )
      /* Soonest first, so the one date printed is the earliest that lapses. */
      .orderBy(asc(patientCredits.expiresAt)),
  ]);

  const creditCents = credits.reduce((sum, c) => sum + (c.amount - c.spent), 0);

  /*
   * 🔴 W2-P14: what is still open, which the account link to this page has
   * always promised ("and anything still open") and the page never listed.
   * Unpaid and waiting-on-a-transfer sessions, each with its own door, at what
   * the patient owes after their benefit rather than the session's price.
   */
  const open = await Promise.all(
    (await sessionDoors(actor.personId))
      .filter((row) => row.door?.kind === "pay" || row.door?.kind === "checking")
      /* 🔴 With VAT: the figure the pay page asks for, not the share before tax. */
      .map(async (row) => ({ ...row, owed: await patientOwesTotal(row.sessionId) })),
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("pbilling.title")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("pbilling.body")}
        </p>
      </div>

      {creditCents > 0 ? (
        <Card className="border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-brand-900">
            <Money cents={creditCents} /> {t("pbill.inCredit")}
          </p>
          {/*
            🔴 P3: WHAT IS TRUE OF IT, AND NOTHING MORE.

            This promised the credit came off a next session, first
            automatically and then "tell us when you book", and nothing in the
            product has ever spent a `patient_credits` row: no pay screen reads
            one, no grant consumes one and no operator screen lists one.
            `reassignSession` no longer writes them, so what a patient can
            still see here is an old row, and what is true of it is that we owe
            it and it stays on their account until it lapses.

            The words are a dictionary key rather than the row's `reason`,
            which is English stored for an operator and was printed as is to an
            Arabic reader. Every row was written with that same reason.
          */}
          <p className="mt-1 text-xs leading-relaxed text-brand-800">
            {t("pbill.creditBody", {
              date: formatDate(credits[0]?.expiresAt ?? null, actor.timezone, locale),
            })}
          </p>
        </Card>
      ) : null}

      {open.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-slate-900">{t("pbilling.open")}</h2>
          <ul className="mt-2 space-y-2">
            {open.map((row) => (
              <li key={row.sessionId}>
                <Card className="p-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{row.therapistName}</p>
                    <p className="text-sm font-semibold tabular-nums text-slate-900">
                      <Money cents={row.owed} />
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDate(row.at, actor.timezone, locale)}
                  </p>
                  <Link
                    href={row.door!.href}
                    className="mt-3 inline-flex h-10 items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-navy-600"
                  >
                    {row.door!.kind === "checking" ? t("transfer.checking") : t("porb.pay")}
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {paid.length === 0 && open.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-900">{t("pbilling.none")}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {t("pbilling.noneBody")}
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {paid.map((row) => (
            <li key={row.sessionId}>
              <Card className="p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {[row.therapistFirst, row.therapistLast].filter(Boolean).join(" ")}
                    {row.status === "refunded" ? (
                      <span className="ms-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {t("pbilling.refunded")}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-slate-900">
                    {/*
                      🔴 "Covered" only when the company paid all of it. A
                      half-covered session showed "Covered" while the patient
                      owed, and after they paid, their half never appeared.
                    */}
                    {row.fundingSource === "pot" && (row.patientShare ?? 0) > 0
                      ? <Money cents={(row.patientShare ?? 0) + (row.vat ?? 0)} currency={row.currency ?? "usd"} />
                      : row.fundingSource === "pot"
                      ? t("pbilling.covered")
                      : row.presented !== null && row.presentedCurrency
                        ? <Money cents={row.presented} currency={row.presentedCurrency} />
                        : <Money cents={(row.gross ?? 0) + (row.vat ?? 0)} currency={row.currency ?? "usd"} />}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDate(row.at, actor.timezone, locale)}
                  {/* 🔴 P3: in the reader's language, like every other line on this page. */}
                  {row.presented !== null && row.rateMicro
                    ? ` · ${t("pbill.chargedAt", {
                        rate: (row.rateMicro / 1_000_000).toFixed(2),
                        from: (row.presentedCurrency ?? "").toUpperCase(),
                        to: (row.currency ?? "usd").toUpperCase(),
                      })}`
                    : ""}
                </p>

                {/*
                  Three lines, with reasons. Never one number.

                  🔴 And not at all for a covered session. The split is what the
                  PATIENT paid and how it was divided; a person who paid nothing has
                  no split to be shown, and printing one under the word "covered" is
                  the kind of thing somebody reads as a bill they owe.
                */}
                {row.fundingSource === "pot" ? (
                  <p className="mt-2 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500">
                    {t("pbilling.coveredBody")}
                  </p>
                ) : (
                <dl className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs">
                  <Row label={t("pbill.therapistFee")}>
                    <Money cents={row.gross ?? 0} currency={row.currency ?? "usd"} />
                  </Row>
                  <Row label={t("pbill.vat")}>
                    <Money cents={row.vat ?? 0} currency={row.currency ?? "usd"} />
                  </Row>
                  <Row label={t("pbill.platformShare")}>
                    <Money cents={row.fee ?? 0} currency={row.currency ?? "usd"} />
                  </Row>
                </dl>
                )}

                {/* 🔴 Task 40: a receipt for what THEY paid; a session covered in full has none. */}
                {row.fundingSource !== "pot" || (row.patientShare ?? 0) > 0 ? (
                  <Link
                    href={`/patient/billing/receipt/${row.paymentId}`}
                    className="mt-2 inline-flex text-xs font-semibold text-brand-700 hover:underline"
                  >
                    {t("preceipt.open")}
                  </Link>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/*
        🔴 65.5 — TWO CURRENCIES, AS TWO COLUMNS.

        41 words in the palest grey on the page explaining which of two numbers is which,
        under a list in which both numbers appear. A reader comparing two figures does not
        want a paragraph about the comparison, they want the comparison.
      */}
      <BeforeAfter
        beforeLabel={t("pbilling.youPaidLabel")}
        before={t("pbilling.youPaidBody")}
        afterLabel={t("pbilling.theyGetLabel")}
        after={t("pbilling.theyGetBody")}
      />
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="tabular-nums text-slate-700">{children}</dd>
    </div>
  );
}
