import "server-only";

import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";

import { guessOutcome, type GuessOutcome } from "@/lib/auth/attempts";
import type { controlDb } from "@/lib/db";
import { patientAuthTokens, RESET_CODE_ATTEMPTS } from "@/lib/db/schema";

type Database = typeof controlDb;
type Purpose = (typeof patientAuthTokens.$inferSelect)["purpose"];
type Channel = (typeof patientAuthTokens.$inferSelect)["channel"];

/**
 * DD-2 B2.2: one guess at a patient's six digit code, counted by the database.
 *
 * The four code checks read `attempts`, added one in Node and wrote it back,
 * so parallel guesses all read the same number and each recorded one. Now the
 * guess is counted FIRST, by `attempts = attempts + 1` in an UPDATE that only
 * matches a live code with guesses left, and only then compared. A right code
 * is spent by a second conditional UPDATE (`used_at IS NULL`), so two tabs
 * with the same code cannot both use it. When the guesses run out, every live
 * code of that purpose for the account is spent, so asking for a new code is
 * the only way on.
 */
export type Guess =
  | { outcome: "match"; id: string; channel: Channel }
  | { outcome: Exclude<GuessOutcome, "match"> };

export async function spendCodeGuess(
  db: Database,
  input: {
    accountId: string;
    purpose: Purpose;
    /** Only codes sent on this channel. */
    channel?: Channel;
    matches: (tokenHash: string) => boolean;
  },
): Promise<Guess> {
  const live = and(
    eq(patientAuthTokens.patientAccountId, input.accountId),
    eq(patientAuthTokens.purpose, input.purpose),
    input.channel ? eq(patientAuthTokens.channel, input.channel) : undefined,
    isNull(patientAuthTokens.usedAt),
    gt(patientAuthTokens.expiresAt, new Date()),
  );

  const [newest] = await db
    .select({ id: patientAuthTokens.id })
    .from(patientAuthTokens)
    .where(live)
    .orderBy(desc(patientAuthTokens.createdAt))
    .limit(1);
  if (!newest) return { outcome: "wrong" };

  const [counted] = await db
    .update(patientAuthTokens)
    .set({ attempts: sql`${patientAuthTokens.attempts} + 1` })
    .where(
      and(
        eq(patientAuthTokens.id, newest.id),
        isNull(patientAuthTokens.usedAt),
        gt(patientAuthTokens.expiresAt, new Date()),
        lt(patientAuthTokens.attempts, RESET_CODE_ATTEMPTS),
      ),
    )
    .returning({
      attempts: patientAuthTokens.attempts,
      tokenHash: patientAuthTokens.tokenHash,
      channel: patientAuthTokens.channel,
    });

  const outcome = guessOutcome({
    attemptsAfter: counted?.attempts ?? null,
    matched: Boolean(counted) && input.matches(counted!.tokenHash),
    limit: RESET_CODE_ATTEMPTS,
  });

  if (outcome === "match") {
    const spent = await db
      .update(patientAuthTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(patientAuthTokens.id, newest.id), isNull(patientAuthTokens.usedAt)))
      .returning({ id: patientAuthTokens.id });
    return spent.length === 1 ? { outcome: "match", id: newest.id, channel: counted!.channel } : { outcome: "wrong" };
  }

  if (outcome === "exhausted") {
    await db.update(patientAuthTokens).set({ usedAt: new Date() }).where(live);
  }
  return { outcome };
}
