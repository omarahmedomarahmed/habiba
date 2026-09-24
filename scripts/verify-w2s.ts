/**
 * Wave 2, the company portal: every dead end gets a way forward. `takeover/FIX-PLAN.md`.
 *
 *   npm run verify:w2s
 *
 * One section per W2-S item that needs the database. Every check was written
 * first and seen to FAIL on the code it describes, then the fix made it pass.
 * Fixtures are planted and removed in a `finally` (H29), and `writesTo()`
 * refuses production by name.
 */
import { sql } from "drizzle-orm";

import { readSource, reporter, required, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `w2s-${Date.now().toString(36)}`;

type Db = ReturnType<typeof connect>["db"];

/** Plant an active company with one admin user. Removed by `dropSponsor`. */
async function plantSponsor(db: Db, label: string): Promise<string> {
  const [sp] = (
    await db.execute(sql`
      INSERT INTO sponsors (name, kind, entity, currency, state)
      VALUES (${`W2S ${label} ${fixture}`}, 'company', 'us', 'USD', 'active') RETURNING id`)
  ).rows as { id: string }[];
  const sponsorId = required(sp, "a sponsor").id;
  await db.execute(sql`
    INSERT INTO sponsor_users (sponsor_id, email, role)
    VALUES (${sponsorId}, ${`hr-${label}-${fixture}@example.com`}, 'admin')`);
  return sponsorId;
}

async function dropSponsor(db: Db, sponsorId: string) {
  await db.execute(sql`DELETE FROM audit_log WHERE resource_id IN
    (SELECT id FROM sponsor_pots WHERE sponsor_id = ${sponsorId})`);
  await db.execute(sql`DELETE FROM ledger_entries WHERE ref_id = ${sponsorId}`);
  await db.execute(sql`DELETE FROM sponsor_pots WHERE sponsor_id = ${sponsorId}`);
  await db.execute(sql`DELETE FROM sponsor_codes WHERE sponsor_id = ${sponsorId}`);
  await db.execute(sql`DELETE FROM sponsor_users WHERE sponsor_id = ${sponsorId}`);
  await db.execute(sql`DELETE FROM sponsors WHERE id = ${sponsorId}`);
}

const YEAR = 365 * 24 * 60 * 60 * 1000;

/* ================================================================== */
/*  W2-S02 · the balance is republished on every top-up                */
/* ================================================================== */

async function balanceAfterTopUp(db: Db) {
  const sponsorId = await plantSponsor(db, "topup");
  try {
    const { openPot } = await import("../lib/data/sponsor-admin");
    const { potBalance } = await import("../lib/data/sponsors");

    await openPot({
      sponsorId,
      refundPolicy: "Unused balance is refunded within 30 days of written notice.",
      expiresAt: new Date(Date.now() + YEAR),
      overdraftCents: 0,
      welcomeCreditCents: 10_000,
    });

    const opened = await potBalance(sponsorId);
    check(
      "W2-S02 a pot opened with a credit shows that credit, before any session",
      opened.balanceCents === 10_000,
      `published ${String(opened.balanceCents)}`,
    );

    /*
     * The differencing half: sessions have been spent since the last
     * publication (the live balance is lower than the published one), and a
     * top-up must move the published figure by the top-up alone.
     */
    await db.execute(sql`
      UPDATE sponsor_pots SET balance_cents = 7000, published_balance_cents = 10000
       WHERE sponsor_id = ${sponsorId}`);

    const pot = (await import("../lib/billing/pot")) as Record<string, unknown>;
    const publishTopUp = pot.publishTopUp as
      | ((sponsorId: string, creditCents: number) => Promise<void>)
      | undefined;
    if (!publishTopUp) {
      check("W2-S02 a top-up moves the published balance by the top-up and nothing else", false, "no publishTopUp");
    } else {
      await db.execute(sql`UPDATE sponsor_pots SET balance_cents = 12000 WHERE sponsor_id = ${sponsorId}`);
      await publishTopUp(sponsorId, 5_000);
      const after = await potBalance(sponsorId);
      check(
        "W2-S02 a top-up moves the published balance by the top-up and nothing else",
        after.balanceCents === 15_000,
        `published ${String(after.balanceCents)}, live 12000: the hidden spend stays hidden`,
      );
    }

    const grants = readSource("lib/billing/manual-grants.ts");
    const card = readSource("lib/billing/pot.ts");
    check(
      "W2-S02 both top-up rails publish what they credit",
      /publishTopUp\(payment\.sponsorId, net\)/.test(grants) &&
        /publishTopUp\(input\.sponsorId, net\)/.test(card),
      "grantPotTopUp and topUpPot",
    );
  } finally {
    await dropSponsor(db, sponsorId);
  }
}

/* ================================================================== */
/*  W2-S03 · the company can make its first joining code               */
/* ================================================================== */

async function firstCode(db: Db) {
  const sponsorId = await plantSponsor(db, "code");
  try {
    const admin = (await import("../lib/data/sponsor-admin")) as Record<string, unknown>;
    const mintFirstCode = admin.mintFirstCode as
      | ((sponsorId: string) => Promise<{ code?: string; error?: string }>)
      | undefined;
    if (!mintFirstCode) {
      check("W2-S03 a company with no code can mint its first one", false, "no mintFirstCode");
      return;
    }

    const first = await mintFirstCode(sponsorId);
    const { liveCode } = await import("../lib/data/sponsors");
    check(
      "W2-S03 a company with no code can mint its first one",
      Boolean(first.code) && (await liveCode(sponsorId)) === first.code,
      first.error ?? "live",
    );

    const second = await mintFirstCode(sponsorId);
    check(
      "W2-S03 …and it cannot replace a live one, so no poster is stranded by it",
      Boolean(second.error) && (await liveCode(sponsorId)) === first.code,
      second.error ?? "it minted a second code",
    );
  } finally {
    await dropSponsor(db, sponsorId);
  }
}

/* ================================================================== */
/*  W2-S09 · an enquiry is followed through                            */
/* ================================================================== */

async function enquiry(db: Db) {
  const email = `enquiry-${fixture}@example.com`;
  const started = new Date();
  try {
    const { applyToSponsor } = await import("../lib/data/sponsor-admin");
    const apply = applyToSponsor as unknown as (input: Record<string, unknown>) => Promise<{
      ok?: true;
      error?: string;
    }>;
    const input = {
      name: `W2S Textiles ${fixture}`,
      kind: "company",
      contactName: "Salma Example",
      contactEmail: email,
      contactPhone: "+20 100 000 0000",
      contactBestTime: "mornings",
      country: "EG",
      acknowledgement: { subject: "We have your enquiry", body: "We will call Salma." },
    };

    const first = await apply(input);
    const second = await apply({ ...input, contactEmail: email.toUpperCase() });

    const rows = (
      await db.execute(sql`
        SELECT entity, currency FROM sponsors WHERE lower(contact_email) = ${email}`)
    ).rows as { entity: string; currency: string }[];

    check(
      "W2-S09 an Egyptian company's enquiry lands on the Egyptian entity",
      Boolean(first.ok) && rows[0]?.entity === "eg" && rows[0]?.currency === "egp",
      JSON.stringify(rows[0] ?? first),
    );
    check(
      "W2-S09 the same enquiry twice makes one held account, not two",
      Boolean(second.ok) && rows.length === 1,
      `${rows.length} rows`,
    );

    const told = (
      await db.execute(sql`
        SELECT kind, count(*)::int AS n FROM delivery_attempts
         WHERE kind IN ('sponsor.enquiry', 'sponsor.enquiry_received')
           AND created_at >= ${started}
         GROUP BY kind`)
    ).rows as { kind: string; n: number }[];
    const n = (kind: string) => told.find((row) => row.kind === kind)?.n ?? 0;

    check(
      "W2-S09 the applicant is told we have it, each time they ask",
      n("sponsor.enquiry_received") === 2,
      `${n("sponsor.enquiry_received")} acknowledgements`,
    );

    const staff = (
      await db.execute(sql`
        SELECT count(*)::int AS n FROM users
         WHERE role IN ('staff', 'manager', 'super_admin') AND deleted_at IS NULL`)
    ).rows as { n: number }[];
    check(
      "W2-S09 our staff are told about a new enquiry, once, not about the repeat",
      (staff[0]?.n ?? 0) === 0 ? true : n("sponsor.enquiry") === Math.min(10, staff[0]!.n),
      `${n("sponsor.enquiry")} staff alerts for ${staff[0]?.n ?? 0} back-office users`,
    );
  } finally {
    await db.execute(sql`DELETE FROM delivery_attempts
      WHERE kind IN ('sponsor.enquiry', 'sponsor.enquiry_received') AND created_at >= ${started}`);
    await db.execute(sql`DELETE FROM sponsors WHERE lower(contact_email) = ${email}`);
  }
}

async function main() {
  writesTo();

  const { pool, db } = connect();
  try {
    await balanceAfterTopUp(db);
    await firstCode(db);
    await enquiry(db);
  } finally {
    await pool.end();
  }

  finish("wave 2 company");
}

void main();
