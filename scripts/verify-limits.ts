/**
 * 🔴 76.58 — THE RATE LIMITER, AND THE ONE THING THAT WOULD HAVE STOPPED THE RUN.
 *
 *     npm run verify:limits
 *
 * ## What the mini simulation walked into
 *
 * Sign-in is **twenty attempts per fifteen minutes**, bucketed by the caller's
 * /24. That is the right shape for the public internet, where a large NAT
 * sharing a bucket is a documented and accepted cost.
 *
 * The six month run is **twenty cast agents and eight standing agents behind
 * one egress address**, each signing in at the start of every wave and again
 * whenever `age` moves the clock past a session's idle timeout. Twenty-eight
 * against twenty is not close. The run would have stalled in wave 1, every
 * agent would have reported "too many attempts" as a product failure, and
 * nobody would have found the cause for hours.
 *
 * Four runs of a three-flow probe exhausted it, which is how it was found.
 *
 * ## 🔴 WHAT THIS CHECKS, AND WHY BOTH DIRECTIONS MATTER
 *
 * A multiplier that is always on is a limiter that is off. A multiplier that
 * is never on leaves the run stalled. So this asserts BOTH:
 *
 *   - with `SIMULATION_RUNNING` unset, the limit is exactly what the caller
 *     asked for, to the attempt;
 *   - with it set, the limit is wider, and the platform-wide `global:` ceiling
 *     is NOT, because that is the number that would notice a real attack.
 *
 * It refuses production: it writes `rate_limits` rows and deletes them.
 */
import { sql } from "drizzle-orm";

import { readSource, reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const KEY = "verify-limits";

async function main() {
  writesTo();

  const { pool, db } = connect();

  try {
    await sweep(db);

    /* ----------------------------------------------- production behaviour -- */

    /*
     * 🔴 THE MODULE IS IMPORTED TWICE, WITH THE FLAG DIFFERENT EACH TIME.
     *
     * `SIMULATION_RUNNING` is read once at module load, which is right for the
     * product and means a checker cannot flip it between calls. So the module
     * registry is cleared and it is imported again, which is the only way to
     * measure both states in one run without asserting on a variable this file
     * set itself.
     */
    delete process.env.SIMULATION_RUNNING;
    const off = await freshLimiter();

    let verdict = { allowed: true, used: 0, limit: 0 };
    for (let i = 0; i < 6; i++) verdict = await off.consume(`${KEY}:off`, 5, 60);

    check(
      "🔴 with no simulation running, the limit is exactly what the caller asked for",
      !verdict.allowed && verdict.limit === 5,
      `the sixth of five attempts was ${verdict.allowed ? "ALLOWED" : "refused"}, limit reported as ${String(verdict.limit)}`,
    );

    check(
      "🔴 CONTROL …and the fifth was allowed, so it is not refusing everything",
      (await countOf(db, `${KEY}:off`)) === 6,
      "six attempts counted against a limit of five, and the refusal came at the sixth",
    );

    /* ------------------------------------------------ during a simulation -- */

    process.env.SIMULATION_RUNNING = "1";
    const on = await freshLimiter();

    let wide = { allowed: true, used: 0, limit: 0 };
    for (let i = 0; i < 6; i++) wide = await on.consume(`${KEY}:on`, 5, 60);

    check(
      "🔴 while the simulation runs, the same six attempts go through",
      wide.allowed && wide.limit > 5,
      wide.allowed
        ? `six of a widened ${String(wide.limit)} allowed, so twenty-eight agents behind one ` +
          "egress address can each sign in"
        : "still refused at six. The run would stall in wave 1",
    );

    /*
     * 🔴 AND THE ONE THAT MUST NOT MOVE. `globalCeiling` is the platform-wide
     * circuit breaker: if it trips during a run, something is wrong with the
     * run, and a multiplier that widened it would be a multiplier that turned
     * off the only instrument that could say so.
     */
    let ceiling = { allowed: true, used: 0, limit: 0 };
    for (let i = 0; i < 6; i++) ceiling = await on.consume(`global:${KEY}`, 5, 60);

    check(
      "🔴 CONTROL …but the platform-wide ceiling is NOT widened, even then",
      !ceiling.allowed && ceiling.limit === 5,
      ceiling.allowed
        ? "the global ceiling was widened too. It is the only thing that would notice an attack"
        : `still five, still refused at six. ${String(ceiling.limit)} enforced`,
    );

    /*
     * 🔴 THE NUMBER THE RUN ACTUALLY NEEDS, asserted rather than assumed.
     *
     * Twenty-eight agents, six waves, and a sign-in each per wave is 168, plus
     * whatever re-authentication the clock moving causes. Sign-in ships at
     * twenty per fifteen minutes, so the widened figure has to clear the
     * biggest burst the swarm can produce in one window: everybody at once.
     */
    /*
     * 🔴 READ FROM `lib/auth/actions.ts`, NOT FROM THE FIXTURE ABOVE.
     *
     * The first version asserted `wide.limit >= 168` against a test that had
     * asked for a limit of five, so it was checking 5 × the multiplier and
     * reporting the fixture rather than sign-in. A check that measures its own
     * scaffolding is the §6 family, and it went red for the right reason: 125
     * is not a fact about this product.
     */
    const shipped = signInLimit();
    check(
      "🔴 …and the SHIPPED sign-in limit, widened, clears a whole swarm at once",
      shipped !== null && shipped * multiplierFromWiden(wide.limit, 5) >= 28 * 6,
      shipped === null
        ? "could not read LOGINS_PER_WINDOW out of lib/auth/actions.ts"
        : `${String(shipped)} × ${String(multiplierFromWiden(wide.limit, 5))} = ` +
          `${String(shipped * multiplierFromWiden(wide.limit, 5))} sign-ins per fifteen minutes, ` +
          "against 28 agents over 6 waves",
    );
    /* ---------------------------------- 78.6 · the two clocks, measured -- */

    /*
     * 🔴 A WINDOW MUST NOT BE BORN EXPIRED.
     *
     * `consume` compares `window_start` against Postgres's `now()` in every
     * branch, and wrote it with the Node process's clock. Those are two
     * machines, and nothing keeps them in step.
     *
     * A row is then born as old as the skew. Any window SHORTER than the skew
     * is already outside itself the instant it lands, every request takes the
     * reset branch, the count never climbs and the limiter refuses nothing. On
     * the branch this was found the database ran 981ms ahead and a freshly
     * written row measured 1.08 seconds old, which turned `tests/radar.test.ts`
     * from occasionally flaky into failing every run. A limiter that fails open
     * is noticed by whoever is abusing it and by nobody else.
     *
     * This measures the thing itself rather than reading the source: how old is
     * a row the product just wrote, in the opinion of the database that judges
     * it? A hundred milliseconds of round trip is expected. A second is the
     * defect.
     */
    const probe = `verify-limits:clock:${String(Date.now())}`;
    const { consume } = await import("../lib/rate-limit");
    await consume(probe, 5, 60);
    const [born] = (
      await db.execute(sql`
        SELECT EXTRACT(EPOCH FROM (now() - window_start))::float8 AS age
          FROM rate_limits WHERE key = ${probe}`)
    ).rows as { age: number }[];
    await db.execute(sql`DELETE FROM rate_limits WHERE key = ${probe}`);

    const age = Number(born?.age ?? 99);
    check(
      "🔴 78.6 a rate limit window is not already old when it is written",
      age < 0.5,
      `${age.toFixed(3)}s old the moment it landed; a window shorter than that never limits`,
    );

    check(
      "🔴 …and it is the database that dates it, not this process",
      /windowStart: sql`now\(\)`/.test(readSource("lib/rate-limit.ts")) &&
        !/windowStart: new Date\(\)/.test(readSource("lib/rate-limit.ts")),
      "two clocks on two machines, either side of one comparison",
    );
  } finally {
    await sweep(db);
    await pool.end();
  }

  finish("sprint 76 limits");
}

/**
 * What sign-in actually ships with, read out of its own file.
 *
 * 🔴 PARSED RATHER THAN COPIED. A constant duplicated into a checker is a
 * constant that stops matching the day somebody tunes the real one, and the
 * checker then passes about a number nothing enforces.
 */
function signInLimit(): number | null {
  /*
   * 🔴 `readSource`, NOT `readFileSync`. C205 is a standing rule of this
   * repository — strip comments before any scan of source, without exception —
   * and this file broke it on its first run, which is how `verify:sprint37l2`
   * found it. A comment in `lib/auth/actions.ts` that happened to mention
   * `LOGINS_PER_WINDOW = 20` would have been read as the constant, and this
   * check would then have been green about a number nothing enforced.
   *
   * Seven checkers in this repository have now matched the prose describing the
   * defect they hunt. A rule forgotten eight times is not a rule, it is a hope.
   */
  const source = readSource("lib/auth/actions.ts");
  const match = source.match(/LOGINS_PER_WINDOW\s*=\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

/** The multiplier the limiter applied, worked back out of what it enforced. */
function multiplierFromWiden(enforced: number, asked: number): number {
  return Math.round(enforced / asked);
}

/** A copy of the limiter that has just read the flag as it is now. */
async function freshLimiter(): Promise<typeof import("../lib/rate-limit")> {
  const path = require.resolve("../lib/rate-limit");
  delete require.cache[path];
  delete require.cache[require.resolve("../lib/env")];
  return import(`../lib/rate-limit?t=${String(Date.now())}${String(Math.random())}`);
}

async function countOf(db: ReturnType<typeof connect>["db"], key: string): Promise<number> {
  const rows = await db.execute<{ count: number }>(sql`
    SELECT count FROM rate_limits WHERE key LIKE ${`%${key}%`} LIMIT 1`);
  return rows.rows[0]?.count ?? 0;
}

async function sweep(db: ReturnType<typeof connect>["db"]): Promise<void> {
  await db.execute(sql`DELETE FROM rate_limits WHERE key LIKE ${`%${KEY}%`}`);
}

main();
