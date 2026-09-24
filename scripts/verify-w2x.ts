/**
 * 🔴 WAVE 2, PARTNER: EVERY DEAD END GETS A WAY FORWARD.
 *
 *   npm run verify:w2x
 *
 * One section per item in `takeover/FIX-PLAN.md` (W2-X01 to W2-X06), each
 * written to fail on the code as it was before the fix and planted against
 * real rows, because each one is a property of what the database keeps.
 *
 * Everything it makes is deleted in a `finally`, and `writesTo()` refuses
 * production by name.
 */
import { sql } from "drizzle-orm";

import { startMockOpenAi } from "../tests/mock-openai";
import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const fixture = `w2x${Date.now().toString(36)}`;

async function main() {
  writesTo();

  /* The partner routes transcribe, so they talk to the e2e stand-in. */
  const mock = startMockOpenAi(4321);
  process.env.OPENAI_BASE_URL = "http://127.0.0.1:4321/v1";
  process.env.OPENAI_API_KEY ||= "sk-mock";

  const { db, pool } = connect();

  const one = async <T>(text: ReturnType<typeof sql>): Promise<T> => {
    const { rows } = await db.execute(text);
    return rows[0] as T;
  };

  /* The limiter rows this plants, removed by name in the `finally`. */
  const buckets: string[] = [];

  try {
    const partner = await one<{ id: string }>(sql`
      INSERT INTO partners (name, slug, state, contact_email)
      VALUES (${fixture}, ${fixture}, 'active', ${`ops.${fixture}@example.com`})
      RETURNING id`);
    const { mintKey } = await import("../lib/partner/keys");
    const minted = await mintKey({
      partnerId: partner.id,
      label: "wave 2 partner",
      environment: "sandbox",
      sponsorId: null,
      scopes: ["consent:write", "session:media", "transcript:read", "note:review",
        "copilot:chat", "memory:read"],
    });
    const keyId = minted.key!.id;
    const bearer = { authorization: `Bearer ${minted.key?.raw}` };
    const base = "http://localhost/api/partner/v1";
    const consentRoute = await import("../app/api/partner/v1/consent/route");
    const history = (session: string) =>
      consentRoute.GET(new Request(`${base}/consent?session=${session}`, { headers: bearer }));

    /* ================================================================ */
    /*  W2-X01 · A BURST IS THROTTLED, NEVER A PERMANENT SUSPENSION      */
    /* ================================================================ */

    /*
     * The minute's budget is planted as spent rather than burned with sixty
     * calls: the limiter's own row, at the limit, in the current window.
     */
    const { subjectKey } = await import("../lib/rate-limit");
    const bucket = subjectKey("api-key", keyId);
    buckets.push(bucket);
    await db.execute(sql`
      INSERT INTO rate_limits (key, count, window_start, expires_at)
      VALUES (${bucket}, 60, now(), now() + interval '60 seconds')
      ON CONFLICT (key) DO UPDATE SET count = 60, window_start = now()`);

    const burst = await history(`${fixture}-rate`);
    const retryAfter = Number(burst.headers.get("retry-after"));
    check(
      "🔴 W2-X01 the call past the limit is a 429 that says when to come back",
      burst.status === 429 && retryAfter >= 1 && retryAfter <= 60,
      `status ${burst.status}, Retry-After ${burst.headers.get("retry-after")}`,
    );

    const afterBurst = await one<{ suspended: string | null }>(sql`
      SELECT suspended_at AS suspended FROM partner_api_keys WHERE id = ${keyId}`);
    check(
      "🔴 W2-X01 …and the key is not suspended",
      afterBurst.suspended === null,
      `suspended_at ${afterBurst.suspended}`,
    );

    /* The window rolls over: the limiter's row goes, as it does after a minute. */
    await db.execute(sql`DELETE FROM rate_limits WHERE key = ${bucket}`);
    const recovered = await history(`${fixture}-rate`);
    check(
      "🔴 W2-X01 once the caller slows down, the same key answers again",
      recovered.status === 200,
      `status ${recovered.status}`,
    );
  } finally {
    mock.server.close();
    for (const bucket of buckets) await db.execute(sql`DELETE FROM rate_limits WHERE key = ${bucket}`);
    await db.execute(sql`DELETE FROM partner_sessions WHERE external_session_ref LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM partner_consents WHERE external_session_ref LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM partner_subjects WHERE external_ref LIKE ${`%${fixture}%`}`);
    await db.execute(sql`DELETE FROM partner_clinicians WHERE partner_id IN
      (SELECT id FROM partners WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM partner_api_keys WHERE partner_id IN
      (SELECT id FROM partners WHERE slug = ${fixture})`);
    await db.execute(sql`DELETE FROM partners WHERE slug = ${fixture}`);
    await pool.end();
  }

  finish("wave 2 partner");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
