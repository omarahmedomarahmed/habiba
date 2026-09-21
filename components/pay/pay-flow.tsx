"use client";

import { useEffect, useState, useTransition } from "react";

import { useT } from "@/lib/i18n/client";
import { Globe, Loader2, ShieldCheck } from "lucide-react";

import { priceFor, startPayment, type Breakdown } from "@/app/pay/[token]/actions";
import { formatMoney } from "@/lib/billing/plans";
import { Button, Card, Field, Input } from "@/components/ui";

/**
 * Country, then price, then pay.
 *
 * ## Why the breakdown is three lines
 *
 * §3: the patient and the therapist each see the split as separate lines with
 * reasons, "never one number". A single total hides the tax, and a person who
 * discovers a 14% VAT line on their bank statement rather than on this page has
 * been surprised by their therapist's invoice — which is a bad way to start.
 *
 * ## Why the rate is named
 *
 * When the price is converted, the rate and its expiry are shown. A patient
 * comparing this figure to a currency app should be able to see why it differs,
 * and a quote that is honoured for an hour is only reassuring if you say so.
 */
export function PayFlow({
  token,
  therapistName,
  knownName,
  countries,
  locale,
}: {
  token: string;
  therapistName: string;
  knownName: string;
  countries: Array<{ code: string; name: string; currency: string }>;
  /**
   * 🔴 19.4 — the reader's language, from the server.
   *
   * This is the screen where somebody in crisis is asked for money in a
   * currency they may not think in. Formatting it in the runtime's locale
   * would differ between the server pass and the browser, and formatting it
   * in English on an Arabic page is the specific thing 19.4 exists to stop.
   */
  locale: string;
}) {
  const [country, setCountry] = useState("");
  const [name, setName] = useState(knownName);
  const [email, setEmail] = useState("");
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const t = useT();
  const [pending, startTransition] = useTransition();

  // Price follows the country. Recomputed on the server every time — the VAT
  // rate, the currency and the exchange rate are all facts the server holds.
  useEffect(() => {
    if (!country) {
      setBreakdown(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void priceFor(token, country).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if ("error" in result) {
        setBreakdown(null);
        setError(result.error);
      } else {
        setBreakdown(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [country, token]);

  const pay = () =>
    startTransition(async () => {
      setError(null);
      const result = await startPayment({ token, countryCode: country, name, email });
      if (result.error) setError(result.error);
      // A payment link is a redirect, not a fetch.
      else if (result.payUrl) window.location.href = result.payUrl;
    });

  /*
   * 12.3 / C84 — a named locale, not the runtime's.
   *
   * This was `toLocaleString(undefined, …)`, which reads the *runtime's*
   * locale: `en-US` on the server and whatever the visitor's browser says in
   * the client pass. Not a date, but exactly the same mismatch — on the public
   * payment screen, where the number is the whole point.
   */
  /** 19.4 — every figure on this screen, in the reader's language. */
  const money = (cents: number, currency: string) => formatMoney(cents, currency, locale);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("pay.title")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {therapistName ? `With ${therapistName}.` : ""} You will not be charged until you confirm
          on the next screen.
        </p>
      </div>

      <Card className="space-y-4 p-4">
        <Field label={t("pay.whereFrom")} htmlFor="country">
          <div className="relative">
            <Globe
              className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-slate-400"
              aria-hidden
            />
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 text-slate-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 focus:outline-none"
            >
              <option value="">{t("pay.chooseCountry")}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} · {c.currency.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {t("pay.setsCurrency")}
          </p>
        </Field>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t("pay.working")}
          </p>
        ) : null}

        {breakdown ? (
          <div className="rounded-2xl bg-slate-50 p-4">
            {/*
              Three lines with reasons. Never one number.
              H8: this region changes when the country changes, which is a
              user-initiated update rather than an announcement, so it carries
              no live region — the page has one and it belongs to errors.
            */}
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-600">{t("pay.session")}</dt>
                <dd className="tabular-nums text-slate-900">
                  {money(breakdown.presentedGrossCents, breakdown.currency)}
                </dd>
              </div>
              {breakdown.vatCents > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">
                    VAT ({(breakdown.vatBps / 100).toFixed(breakdown.vatBps % 100 === 0 ? 0 : 1)}%)
                    <span className="block text-xs text-slate-400">
                      {t("pay.vatTo", { country: breakdown.countryName })}
                    </span>
                  </dt>
                  <dd className="tabular-nums text-slate-900">
                    {money(breakdown.presentedVatCents, breakdown.currency)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-1.5 font-semibold">
                <dt className="text-slate-900">{t("pay.total")}</dt>
                <dd className="tabular-nums text-slate-900">
                  {money(breakdown.presentedTotalCents, breakdown.currency)}
                </dd>
              </div>
            </dl>

            {breakdown.currency !== "usd" ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                {t("pay.converted", {
                  amount: money(breakdown.totalCents, "usd"),
                  rate: (breakdown.rateMicro / 1_000_000).toFixed(2),
                  currency: breakdown.currency.toUpperCase(),
                })}
                {breakdown.rateSource === "static" ? (
                  <span className="mt-1 block text-amber-700">
                    {t("pay.indicative")}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        {breakdown ? (
          <>
            <Field label={t("pay.firstName")} htmlFor="payer-name">
              <Input
                id="payer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("pay.namePlaceholder")}
                required
              />
            </Field>
            <Field label={t("pay.receiptEmail")} htmlFor="payer-email">
              <Input
                id="payer-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
          </>
        ) : null}

        {error ? (
          <p role="alert" aria-live="assertive" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <Button
          full
          size="lg"
          disabled={!breakdown || pending || !name.trim()}
          onClick={pay}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t("pay.opening")}
            </>
          ) : breakdown ? (
            t("pay.payAmount", { amount: money(breakdown.presentedTotalCents, breakdown.currency) })
          ) : (
            t("pay.chooseToContinue")
          )}
        </Button>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
          {t("pay.stripeNote")}
        </p>
      </Card>
    </main>
  );
}
