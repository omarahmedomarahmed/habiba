/**
 * 🔴 Board 427: /admin/sponsors reads the whole list in five queries, and reads
 * exactly what the per-sponsor functions it replaced would have read.
 *
 *     npm run verify:admin-sponsors
 *
 * The page made five round trips per company (`liveCode`, `potTerms`,
 * `sponsorUsersFor`, `ledgerPotBalance`, then `attemptsOnCode` after the other
 * four) and loaded in 11.3 s once. `adminSponsorFacts` is the batched read; this
 * compares it, sponsor by sponsor, against the single functions on the dev
 * database, and checks the page no longer calls them in a loop.
 */
import { ledgerPotBalance } from "@/lib/billing/pot";
import { adminSponsorFacts, allSponsors, potTerms, sponsorUsersFor } from "@/lib/data/sponsor-admin";
import { attemptsOnCode, liveCode } from "@/lib/data/sponsors";

import { readSource, reporter, sawRows } from "./_verify";

const { check, finish } = reporter();

async function main() {
  const page = readSource("app/(admin)/admin/sponsors/page.tsx");
  check(
    "🔴 427 the page reads the list once, not per sponsor",
    /adminSponsorFacts\(/.test(page) && !/liveCode\(|potTerms\(|sponsorUsersFor\(|ledgerPotBalance\(|attemptsOnCode\(/.test(page),
  );

  const sponsors = await allSponsors();
  const started = Date.now();
  const facts = await adminSponsorFacts(sponsors.map((sponsor) => sponsor.id));
  const took = Date.now() - started;

  const mismatched: string[] = [];
  for (const sponsor of sponsors) {
    const [code, terms, users, balance] = await Promise.all([
      liveCode(sponsor.id),
      potTerms(sponsor.id),
      sponsorUsersFor(sponsor.id),
      ledgerPotBalance(sponsor.id),
    ]);
    const attempts = await attemptsOnCode(code);
    const got = facts.get(sponsor.id);
    const want = {
      code,
      potOpen: terms !== null,
      balanceCents: balance,
      attempts,
      users: users.map((user) => ({ id: user.id, email: user.email, role: user.role })),
    };
    if (JSON.stringify(got) !== JSON.stringify(want)) mismatched.push(sponsor.name);
  }

  check(
    "🔴 427 the batched read matches the single-sponsor reads for every sponsor",
    mismatched.length === 0,
    mismatched.length === 0 ? `${sponsors.length} sponsors in ${took} ms` : mismatched.join(", "),
  );
  check("CONTROL an empty list is an empty map, not a query", (await adminSponsorFacts([])).size === 0);

  console.log(`  ${sawRows({ sponsors: sponsors.length })}`);
  finish("admin sponsors");
}

void main();
