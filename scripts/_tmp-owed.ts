import { patientOwesFor, sessionLines } from "@/lib/billing/session-owed";
import { sessionTransferMoney } from "@/lib/billing/manual-entry";
import { egpMinorFor, egpRateMicro } from "@/lib/billing/manual";
import { controlDb } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const { rows } = await controlDb.execute(
    sql`SELECT id, price_cents, organization_id FROM sessions WHERE join_token = 'join-coverage-demo'`,
  );
  const s = rows[0] as { id: string; price_cents: number; organization_id: string };

  const owed = await patientOwesFor(s.id);
  const money = await sessionTransferMoney({ organizationId: s.organization_id, priceCents: owed.grossCents });
  const wrong = await sessionTransferMoney({ organizationId: s.organization_id, priceCents: s.price_cents });
  const rate = await egpRateMicro();

  console.log(`  session priced at         $${owed.priceCents / 100}`);
  console.log(`  the benefit already paid  $${owed.coveredCents / 100}`);
  console.log(`  so the patient owes       $${owed.grossCents / 100} + $${money.vatCents / 100} VAT`);
  console.log(`  which is                  ${egpMinorFor(money.settlesCents, rate) / 100} EGP   <- what the sheet asks for now`);
  console.log(`  BEFORE THE FIX it asked   ${egpMinorFor(wrong.settlesCents, rate) / 100} EGP   <- the employer's half, charged again`);
  console.log(`  a patient was overcharged ${(egpMinorFor(wrong.settlesCents, rate) - egpMinorFor(money.settlesCents, rate)) / 100} EGP on a ${egpMinorFor(owed.priceCents, rate) / 100} EGP session`);

  const lines = sessionLines({
    owed,
    vatCents: money.vatCents,
    sessionLabel: "Session with Mona Demo",
    benefitLabel: "Your benefit paid",
    vatLabel: "VAT",
  });
  console.log("\n  the lines the sheet prints:");
  for (const l of lines) console.log(`    ${l.label.padEnd(24)} ${egpMinorFor(l.cents, rate) / 100} EGP`);
  console.log(`    ${"they sum to".padEnd(24)} ${egpMinorFor(lines.reduce((a, b) => a + b.cents, 0), rate) / 100} EGP`);
}

main();
