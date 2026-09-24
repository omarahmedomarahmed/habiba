import "server-only";

import { sql } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";

/**
 * 🔴 0149 — WHEN THE OPERATOR MOVES THE RATE, EVERY PRICE TYPED IN POUNDS
 * STAYS THE SAME NUMBER OF POUNDS.
 *
 * `session_rate_cents` is dollars for every path that charges; the pounds a
 * therapist typed are in `rate_egp_minor`. So the dollars are re-derived here,
 * in one statement, and a therapist who charges 1,000 EGP still charges
 * 1,000 EGP the morning after the pound moves. Sessions already booked keep
 * the dollars they were booked at.
 */
export async function rederiveEgpRates(rateMicro: number): Promise<number> {
  if (!Number.isFinite(rateMicro) || rateMicro <= 0) return 0;
  const result = await db.execute(sql`
    UPDATE users
       SET session_rate_cents = ROUND(rate_egp_minor * 1000000.0 / ${rateMicro})::int,
           updated_at = now()
     WHERE rate_egp_minor IS NOT NULL
       AND session_rate_cents <> ROUND(rate_egp_minor * 1000000.0 / ${rateMicro})::int
    RETURNING id`);
  return result.rows.length;
}
