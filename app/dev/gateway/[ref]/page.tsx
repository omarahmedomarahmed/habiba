import { notFound, redirect } from "next/navigation";

import { POST as gatewayCallback } from "@/app/api/gateway/callback/route";
import { Button, Card } from "@/components/ui";
import { recordFakeOutcome, SIGNATURE_HEADER, signFake } from "@/lib/billing/gateway/fake";
import { env } from "@/lib/env";

import { simulatorOn } from "../../simulator";

export const dynamic = "force-dynamic";

/**
 * 🔴 64.1: THE SIMULATED HOSTED CHECKOUT. Development and verifiers only.
 *
 * Stands where a real gateway's card page will stand. Pressing Pay or Decline
 * does what a gateway does: its own record changes, and a SIGNED callback is
 * delivered to our callback route, which verifies it like any other. Then the
 * payer is sent back to the return address, where the page asks for the status.
 */
async function answer(formData: FormData) {
  "use server";
  if (!simulatorOn("gateway")) notFound();
  const providerRef = String(formData.get("providerRef") ?? "");
  const reference = String(formData.get("reference") ?? "");
  const amountMinor = Number(formData.get("amount") ?? 0);
  const outcome = formData.get("outcome") === "paid" ? "paid" : "failed";
  const event = {
    providerRef,
    reference,
    outcome,
    transactionId: outcome === "paid" ? `fake_txn_${crypto.randomUUID()}` : null,
    amountMinor,
    currency: "egp",
    failure: outcome === "failed" ? "Declined by the card holder's bank (simulated)." : null,
  } as const;
  recordFakeOutcome(event);
  const rawBody = JSON.stringify(event);
  await gatewayCallback(
    new Request(`${env.appUrl}/api/gateway/callback`, {
      method: "POST",
      headers: { [SIGNATURE_HEADER]: signFake("collection", rawBody), "content-type": "application/json" },
      body: rawBody,
    }),
  );
  const back = String(formData.get("return") ?? "/");
  redirect(back.startsWith(env.appUrl) ? back : "/");
}

export default async function SimulatedCheckout({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!simulatorOn("gateway")) notFound();
  const { ref } = await params;
  const query = await searchParams;
  const amount = Number(query.amount ?? 0);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
      <Card className="space-y-3 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Simulated gateway</p>
        <p className="text-2xl font-bold text-slate-900">{(amount / 100).toFixed(2)} EGP</p>
        <p className="text-xs text-slate-500">No real card is charged here.</p>
        <form action={answer} className="flex gap-2">
          <input type="hidden" name="providerRef" value={ref} />
          <input type="hidden" name="reference" value={query.reference ?? ""} />
          <input type="hidden" name="amount" value={String(amount)} />
          <input type="hidden" name="return" value={query.return ?? "/"} />
          <Button type="submit" name="outcome" value="paid" full>
            Pay
          </Button>
          <Button type="submit" name="outcome" value="failed" variant="secondary" full>
            Decline
          </Button>
        </form>
      </Card>
    </main>
  );
}
