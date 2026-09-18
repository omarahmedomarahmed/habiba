/**
 * Local screenshot preparation, and it refuses production.
 *
 *     npm run screens:prep
 *
 * The lesson of the `$3,500 7` cell is that a page can be green on every gate
 * and unreadable on the screen, and the only way to find that out is to look at
 * it. Looking at it needs a password that works and rows that render, and both
 * of those are a small script rather than five minutes of clicking each time.
 *
 * 🔴 It plants. `writesTo()` with no argument, so it cannot be pointed at the
 * production database, where a $50,000 contribution nobody put in would be on
 * the founders' own balance for ever.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const EMAIL = "admin@24therapy.test";
const PASSWORD = "Screenshots2026!";

/**
 * 🔴 A REAL IMAGE ON DISK, AT A REAL SHAPE, because the modal renders one.
 *
 * `lib/uploads.ts` falls back to `.uploads/` when there is no blob token, and
 * `/api/uploads/...` serves from there, so a receipt planted as a file is a
 * receipt the modal can actually display. A row pointing at a URL that 404s
 * would show the modal's "the store could not produce it" branch, which is a
 * real branch worth seeing and NOT the one being checked here.
 *
 * 🔴 AND IT IS 900 BY 1400, NOT ONE PIXEL. The first version planted the
 * smallest valid PNG, the modal scaled it to one pixel wide, and the layout it
 * was planted to prove was invisible. A receipt is a portrait screenshot from
 * somebody's phone, and the only useful test of a box that holds one is a box
 * holding one.
 */
async function receiptPng(): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1400">
    <rect width="900" height="1400" fill="#f1f5f9"/>
    <rect x="60" y="120" width="780" height="900" rx="28" fill="#ffffff"/>
    <text x="110" y="240" font-family="sans-serif" font-size="46" fill="#0f172a">Transfer sent</text>
    <text x="110" y="330" font-family="sans-serif" font-size="80" fill="#0f172a">EGP 400.00</text>
    <text x="110" y="430" font-family="sans-serif" font-size="34" fill="#64748b">To 24Therapy</text>
    <text x="110" y="500" font-family="sans-serif" font-size="34" fill="#64748b">Ref SCREENS-WITH-PROOF</text>
    <text x="110" y="570" font-family="sans-serif" font-size="34" fill="#64748b">Account ****4471</text>
    <text x="110" y="700" font-family="sans-serif" font-size="30" fill="#94a3b8">A planted fixture. Nobody sent anything.</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  writesTo();

  const { pool, db } = connect();

  try {
    const { hashPassword } = await import("../lib/auth/password");
    const { uploadDocument } = await import("../lib/uploads");
    const hash = await hashPassword(PASSWORD);

    const updated = await db.execute<{ id: string; organization_id: string }>(sql`
      UPDATE users SET password_hash = ${hash}
       WHERE email = ${EMAIL} AND deleted_at IS NULL
       RETURNING id, organization_id`);

    check(
      "the local admin has a password this session knows",
      updated.rows.length === 1,
      updated.rows.length === 1 ? `${EMAIL} / ${PASSWORD}` : `no ${EMAIL} on this branch`,
    );

    const admin = updated.rows[0];

    /* ------------------------------------------------- the money screens -- */

    const now = new Date();
    const month = (back: number): string => {
      const then = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
      return then.toISOString().slice(0, 10);
    };

    await db.execute(sql`DELETE FROM capital_contributions WHERE source IN ('founders', 'angel round')`);
    await db.execute(sql`
      INSERT INTO capital_contributions (amount_cents, received_on, source, note)
      VALUES (2500000, ${month(6)}, 'founders', 'the money we started with'),
             (5000000, ${month(3)}, 'angel round', 'first cheque')`);

    await db.execute(sql`DELETE FROM other_costs WHERE note = 'screens'`);
    for (const back of [5, 4, 3]) {
      await db.execute(sql`
        INSERT INTO other_costs (kind, month, amount_cents, note)
        VALUES ('video', ${month(back)}, 4200, 'screens'),
               ('hosting', ${month(back)}, 3500, 'screens')
        ON CONFLICT (kind, month) DO UPDATE SET amount_cents = EXCLUDED.amount_cents`);
    }

    const counted = await db.execute<{ capital: string; costs: string }>(sql`
      SELECT (SELECT COUNT(*)::text FROM capital_contributions) AS capital,
             (SELECT COUNT(*)::text FROM other_costs) AS costs`);

    check(
      "and there is something on the money screen to look at",
      Number(counted.rows[0]?.capital ?? 0) >= 2 && Number(counted.rows[0]?.costs ?? 0) >= 6,
      `${counted.rows[0]?.capital ?? 0} contributions, ${counted.rows[0]?.costs ?? 0} cost rows`,
    );

    /* ------------------------------------------------ the transfer queue -- */

    if (admin) {
      /*
       * 🔴 A WAITING TRANSFER WITH A REAL FILE BEHIND IT, so the evidence modal
       * has evidence. Two rows: one with a receipt and one without, because the
       * second is the case the operator most needs the screen to shout about
       * and a queue of only the first would never show it.
       */
      await db.execute(sql`DELETE FROM manual_payments WHERE reference LIKE 'SCREENS-%'`);

      /*
       * 🔴 THROUGH `uploadDocument`, NOT WRITTEN TO DISK BY HAND.
       *
       * The first version wrote a PNG into `.uploads/` and stored the
       * `/api/uploads/...` path. `documentUrl` refuses that path whenever a real
       * `BLOB_READ_WRITE_TOKEN` is present — which it is, because `.env.local`
       * carries one and `next dev` reads `.env.local` whatever the shell does —
       * so the modal 404'd over a file that was sitting on disk. Two hours of
       * looking at the wrong half.
       *
       * Going through the product's own upload function means the fixture lands
       * wherever the product would actually put it, which is the only shape
       * worth photographing, and it is rule 2 besides.
       */
      const png = await receiptPng();
      const stored = await uploadDocument({
        kind: "receipt",
        userId: admin.id,
        label: "screens",
        file: new File([new Uint8Array(png)], "receipt.png", { type: "image/png" }),
      });

      if (stored.error || !stored.url) {
        throw new Error(`could not store the fixture receipt: ${stored.error ?? "no url"}`);
      }

      await db.execute(sql`
        INSERT INTO manual_payments (organization_id, user_id, payer_kind, purpose, amount_cents,
                                     currency, settles_cents, reference, proof_url, state, submitted_at)
        VALUES
          (${admin.organization_id}, ${admin.id}, 'user', 'subscription', 40000, 'EGP', 800,
           'SCREENS-WITH-PROOF', ${stored.url}, 'submitted', now()),
          (${admin.organization_id}, ${admin.id}, 'user', 'subscription', 40000, 'EGP', 800,
           'SCREENS-NO-PROOF', NULL, 'submitted', now())`);

      const queued = await db.execute<{ n: string }>(sql`
        SELECT COUNT(*)::text AS n FROM manual_payments
         WHERE reference LIKE 'SCREENS-%' AND state = 'submitted'`);

      check(
        "and two transfers are waiting, one with a receipt and one without",
        Number(queued.rows[0]?.n ?? 0) === 2,
        `${queued.rows[0]?.n ?? 0} on the queue, receipt stored where the product stores them`,
      );
    }
  } finally {
    await pool.end();
  }

  finish("screenshot prep");
}

main();
