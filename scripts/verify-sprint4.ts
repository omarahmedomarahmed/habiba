/**
 * Sprint 4 acceptance, against the real database.
 *
 *   node --import tsx --conditions=react-server scripts/verify-sprint4.ts
 *
 * The claims worth checking are the ones that are easy to get subtly wrong and
 * impossible to notice: that a quote is genuinely reused within its hour, that
 * a country nobody configured is refused rather than defaulted, and that the
 * historical payments the migration touched still say what they always said.
 */
import { desc, eq, sql } from "drizzle-orm";

import { convertAtRate, parseCountry, sessionMoney } from "../lib/settings/defs";
import { connect, schema } from "./db";

const { countrySettings, fxQuotes, sessionPayments, sessions } = schema;

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

async function main() {
  const { pool, db } = connect();
  try {
    /* ------------------------------------------------------- 4.6 session type */

    const types = await db
      .select({ t: sessions.sessionType, n: sql<number>`COUNT(*)::int` })
      .from(sessions)
      .groupBy(sessions.sessionType);
    const byType = Object.fromEntries(types.map((r) => [r.t, r.n]));
    const priced = (
      await db.select({ n: sql<number>`COUNT(*)::int` }).from(sessions).where(sql`price_cents > 0`)
    )[0]!.n;

    console.log(`session types: ${JSON.stringify(byType)}`);
    check(
      "4.6 every priced session is recorded as a paid link",
      (byType.paid_link ?? 0) === priced,
      `${byType.paid_link ?? 0} paid_link vs ${priced} priced`,
    );
    check(
      "4.6 nothing was invented — no session claims to be scheduled",
      (byType.scheduled ?? 0) === 0,
      "scheduling does not exist until sprint 11",
    );

    /* ------------------------------------------- historical payments unchanged */

    const [old] = await db
      .select({
        n: sql<number>`COUNT(*)::int`,
        nonUsd: sql<number>`COUNT(*) FILTER (WHERE currency <> 'usd')::int`,
        withVat: sql<number>`COUNT(*) FILTER (WHERE vat_cents <> 0)::int`,
        atOldRate: sql<number>`COUNT(*) FILTER (WHERE platform_fee_bps = 1000)::int`,
      })
      .from(sessionPayments);

    check(
      "existing payments are still USD with no VAT, which is what they were",
      (old?.nonUsd ?? 0) === 0 && (old?.withVat ?? 0) === 0,
      `${old?.n ?? 0} payment(s)`,
    );
    check(
      "and each records the 10% cut it was actually charged, not today's 15%",
      (old?.atOldRate ?? 0) === (old?.n ?? 0),
      `${old?.atOldRate ?? 0} of ${old?.n ?? 0}`,
    );

    /* -------------------------------------------------------- 4.2 countries */

    const countries = (await db.select().from(countrySettings)).map(parseCountry);
    const egypt = countries.find((c) => c.code === "EG");
    check("4.2 Egypt is configured at 14% in EGP", egypt?.vatBps === 1400 && egypt.currency === "egp");
    check(
      "4.2 an unconfigured country has no row, so it is refused rather than defaulted",
      !countries.some((c) => c.code === "FR"),
      `${countries.length} configured`,
    );

    /* ------------------------------------------------------------- 4.4 FX */

    const { quoteFor, QUOTE_TTL_MS } = await import("../lib/billing/fx");

    const identity = await quoteFor("usd", "usd");
    check("4.4 an identity pair needs no stored quote", identity?.rateMicro === 1_000_000);

    const first = await quoteFor("usd", "egp");
    check("4.4 a real pair quotes", Boolean(first), first ? `${first.rateMicro / 1e6} EGP/USD` : "none");

    const second = await quoteFor("usd", "egp");
    check(
      "4.4 a second request inside the hour reuses the same quote",
      Boolean(first && second) && first!.quotedAt.getTime() === second!.quotedAt.getTime(),
      "the pay page and the checkout must agree",
    );

    const ttlOk =
      first !== null && first.expiresAt.getTime() - first.quotedAt.getTime() === QUOTE_TTL_MS;
    check("4.4 a quote is held for exactly one hour", ttlOk);

    check(
      "4.4 an unpriceable pair is refused rather than guessed",
      (await quoteFor("usd", "jpy")) === null,
      "no rate, no charge",
    );

    const stored = await db
      .select()
      .from(fxQuotes)
      .orderBy(desc(fxQuotes.quotedAt))
      .limit(1);
    check(
      "4.4 the quote records where it came from",
      stored[0]?.source === "static",
      `source=${stored[0]?.source} — an indicative rate must be distinguishable from a real feed`,
    );

    /* ----------------------------------------------- 4.5 the worked example */

    if (egypt && first) {
      const money = sessionMoney({ grossCents: 3000, feeBps: 1500, vatBps: egypt.vatBps });
      check("4.5 §3's worked example: $30 → $34.20 total", money.patientTotalCents === 3420);
      check("4.5 …of which $4.20 is VAT", money.vatCents === 420);
      check("4.5 …$4.50 is our cut", money.platformCutCents === 450);
      check("4.5 …and $25.50 reaches the therapist", money.therapistNetCents === 2550);
      console.log(
        `        in Egypt the patient sees ` +
          `${(convertAtRate(money.patientTotalCents, first.rateMicro) / 100).toFixed(2)} EGP`,
      );
    }
  } finally {
    await pool.end();
  }

  console.log(failures === 0 ? "\nsprint 4: PASS" : `\nsprint 4: ${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main();
