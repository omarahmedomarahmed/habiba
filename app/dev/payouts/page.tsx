import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

import { POST as payoutsCallback } from "@/app/api/payouts/callback/route";
import { Button, Card } from "@/components/ui";
import { recordFakePayout, SIGNATURE_HEADER, signFake } from "@/lib/billing/gateway/fake";
import { controlDb } from "@/lib/db";
import { payoutRequests } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";

import { simulatorOn } from "../simulator";

export const dynamic = "force-dynamic";

/**
 * 🔴 64.1: THE SIMULATED PAYOUTS PROVIDER'S DESK. Development only.
 *
 * Lists what the provider was asked to send and lets a person answer as the
 * provider would, with a signed callback to our route: it arrived, or it did
 * not.
 */
async function answer(formData: FormData) {
  "use server";
  if (!simulatorOn("payouts")) notFound();
  const event = {
    providerRef: String(formData.get("providerRef") ?? ""),
    reference: String(formData.get("reference") ?? ""),
    outcome: formData.get("outcome") === "sent" ? "sent" : "failed",
    failure: formData.get("outcome") === "sent" ? null : "The receiving wallet refused it (simulated).",
  } as const;
  recordFakePayout(event);
  const rawBody = JSON.stringify(event);
  await payoutsCallback(
    new Request(`${env.appUrl}/api/payouts/callback`, {
      method: "POST",
      headers: { [SIGNATURE_HEADER]: signFake("payouts", rawBody), "content-type": "application/json" },
      body: rawBody,
    }),
  );
  revalidatePath("/dev/payouts");
}

export default async function SimulatedPayouts() {
  if (!simulatorOn("payouts")) notFound();
  const { t } = await getI18n();
  const sending = await controlDb
    .select({
      id: payoutRequests.id,
      providerRef: payoutRequests.providerRef,
      amount: payoutRequests.payoutAmountMinor,
      account: payoutRequests.accountName,
    })
    .from(payoutRequests)
    .where(eq(payoutRequests.providerState, "sending"))
    .limit(50);

  return (
    <main className="mx-auto max-w-lg space-y-3 px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{t("sim.payouts")}</p>
      {sending.length === 0 ? <p className="text-sm text-slate-500">{t("sim.nothingSending")}</p> : null}
      {sending.map((row) => (
        <Card key={row.id} className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">{(row.amount / 100).toFixed(2)} EGP</p>
            <p className="text-xs text-slate-500">{row.account}</p>
          </div>
          <form action={answer} className="flex gap-2">
            <input type="hidden" name="providerRef" value={row.providerRef ?? ""} />
            <input type="hidden" name="reference" value={row.id} />
            <Button type="submit" name="outcome" value="sent" className="h-8 px-3 text-xs">
              {t("sim.arrived")}
            </Button>
            <Button type="submit" name="outcome" value="failed" variant="secondary" className="h-8 px-3 text-xs">
              {t("sim.failed")}
            </Button>
          </form>
        </Card>
      ))}
    </main>
  );
}
