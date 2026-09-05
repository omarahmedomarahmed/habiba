"use client";

import { useEffect, useState, useTransition } from "react";
import { Globe, Loader2, ShieldCheck } from "lucide-react";

import { priceFor, startPayment, type Breakdown } from "@/app/pay/[token]/actions";
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
}: {
  token: string;
  therapistName: string;
  knownName: string;
  countries: Array<{ code: string; name: string; currency: string }>;
}) {
  const [country, setCountry] = useState("");
  const [name, setName] = useState(knownName);
  const [email, setEmail] = useState("");
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  const money = (cents: number, currency: string) =>
    (cents / 100).toLocaleString(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Pay for your session</h1>
        <p className="mt-1 text-sm text-slate-500">
          {therapistName ? `With ${therapistName}.` : ""} You will not be charged until you confirm
          on the next screen.
        </p>
      </div>

      <Card className="space-y-4 p-4">
        <Field label="Where are you paying from?" htmlFor="country">
          <div className="relative">
            <Globe
              className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-slate-400"
              aria-hidden
            />
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none"
            >
              <option value="">Choose your country…</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} · {c.currency.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            This sets your currency and any tax that applies where you are.
          </p>
        </Field>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Working out your price…
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
                <dt className="text-slate-600">Session</dt>
                <dd className="tabular-nums text-slate-900">
                  {money(breakdown.presentedGrossCents, breakdown.currency)}
                </dd>
              </div>
              {breakdown.vatCents > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">
                    VAT ({(breakdown.vatBps / 100).toFixed(breakdown.vatBps % 100 === 0 ? 0 : 1)}%)
                    <span className="block text-xs text-slate-400">
                      Paid to the tax authority in {breakdown.countryName}, not to us.
                    </span>
                  </dt>
                  <dd className="tabular-nums text-slate-900">
                    {money(breakdown.presentedVatCents, breakdown.currency)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-1.5 font-semibold">
                <dt className="text-slate-900">Total</dt>
                <dd className="tabular-nums text-slate-900">
                  {money(breakdown.presentedTotalCents, breakdown.currency)}
                </dd>
              </div>
            </dl>

            {breakdown.currency !== "usd" ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Converted from {money(breakdown.totalCents, "usd")} at{" "}
                {(breakdown.rateMicro / 1_000_000).toFixed(2)} {breakdown.currency.toUpperCase()} to
                the dollar. This rate is held for an hour.
                {breakdown.rateSource === "static" ? (
                  <span className="mt-1 block text-amber-700">
                    Indicative rate — your bank's final figure may differ slightly.
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        {breakdown ? (
          <>
            <Field label="Your first name" htmlFor="payer-name">
              <Input
                id="payer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="The name your therapist knows you by"
                required
              />
            </Field>
            <Field label="Email for your receipt (optional)" htmlFor="payer-email">
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
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Opening checkout…
            </>
          ) : breakdown ? (
            `Pay ${money(breakdown.presentedTotalCents, breakdown.currency)}`
          ) : (
            "Choose your country to continue"
          )}
        </Button>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
          Your card is handled by Stripe. We never see the number, and the payment goes to your
          therapist's own account.
        </p>
      </Card>
    </main>
  );
}
