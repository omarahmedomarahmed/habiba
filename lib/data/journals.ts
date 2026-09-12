import "server-only";

import { and, desc, eq, gte, lt } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { dbFor } from "@/lib/db";
import { regionOfPerson } from "@/lib/db/directory";
import { historyGrants, journals, notifications, people } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { scanForCrisisLanguage } from "@/lib/crisis/alerts";



/**
 * Journals. PLAN.md 26.5 to 26.8, C123, C124.
 *
 * ## 🔴 Why journals replaced patient uploads
 *
 * Sprint 8 let a patient add files and dictate their clinical history to their
 * own record. Both were the product asking a person to do a clinician's job:
 * photographing a prescription is filing, and dictating "my history" is
 * writing a clinical document about yourself, in a register nobody has at
 * eleven at night. What a person actually wants to do is say how the week
 * went. So that is what this is.
 *
 * ## 🔴 The scan, and the promise we refuse to make (C123)
 *
 * Somebody writes "I want to die" into a journal at 3am. A journal is
 * therefore scanned exactly as a transcript is, by the same scanner, and a
 * high-risk journal alerts the clinicians holding a live grant.
 *
 * And the page **never says or implies that anyone is watching**. It does not
 * say "your therapist reads this", it does not show a shield, it does not
 * confirm that an alert was raised. Promising monitoring we cannot staff is
 * the most dangerous thing this product could do: a person who believes
 * somebody is reading at 3am and is wrong is worse off than a person who knows
 * they are alone with a phone number on the screen. The crisis line is always
 * on screen, which is the part we can actually keep.
 *
 * `raiseCrisisAlert` is deliberately NOT used: it hangs off a session, and a
 * journal has none. The notification here is the same shape and says what it
 * is.
 */

export type JournalEntry = {
  id: string;
  body: string;
  source: "typed" | "dictated";
  createdAt: Date;
};

/** Their own journals, newest first. */
export async function journalsForPerson(personId: string, limit = 100): Promise<JournalEntry[]> {
  /*
   * 🔴 30.1 / C154 — a journal is the person's, so it lives where they do.
   *
   * Routed on the PERSON rather than on whichever clinician happens to be
   * asking. An Egyptian patient's journal belongs in Egypt even when the
   * clinician reading it is registered in Virginia, and that is the case this
   * seam exists for rather than an edge of it.
   */
  const db = dbFor(await regionOfPerson(personId));

  return db
    .select({
      id: journals.id,
      body: journals.body,
      source: journals.source,
      createdAt: journals.createdAt,
    })
    .from(journals)
    .where(eq(journals.personId, personId))
    .orderBy(desc(journals.createdAt))
    .limit(limit);
}

export type WriteResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Write one.
 *
 * Returns success on the write and says nothing about the scan, whatever the
 * scan found. That is C123's ruling expressed as a return type: there is no
 * field here a screen could accidentally render as "we noticed something".
 */
export async function writeJournal(input: {
  personId: string;
  accountId: string;
  body: string;
  source: "typed" | "dictated";
}): Promise<WriteResult> {
  const body = input.body.trim();
  if (body.length < 1) return { ok: false, error: "Write something first." };
  if (body.length > 20_000) return { ok: false, error: "That is longer than we can store." };

  /* 30.1 — written where the person lives. */
  const db = dbFor(await regionOfPerson(input.personId));

  const indicators = scanForCrisisLanguage(body);
  const level = indicators.length > 0 ? ("high" as const) : null;

  const [row] = await db
    .insert(journals)
    .values({
      personId: input.personId,
      accountId: input.accountId,
      source: input.source,
      body,
      riskLevel: level,
      riskIndicators: indicators,
    })
    .returning({ id: journals.id });

  /*
   * C124 — the same audit a document gets. A patient-authored write into a
   * record a clinician will read is a clinical event whether or not it came
   * through a file picker.
   */
  await audit({
    actor: null,
    patientAccountId: input.accountId,
    category: "phi_access",
    action: "journal.write",
    resourceType: "person",
    resourceId: input.personId,
  });

  if (level) {
    /*
     * Alerting is best effort and never blocks the write. A person mid-sentence
     * at 3am must not see an error because a notification insert failed.
     */
    await alertGrantHolders(input.personId, row!.id, indicators).catch((error) => {
      log.error("journal alert failed", {
        journal: ref(row!.id),
        reason: safeErrorMessage(error),
      });
    });
  }

  return { ok: true, id: row!.id };
}

/**
 * Tell the clinicians who hold a live grant. 26.7, C123.
 *
 * Only live grants, which is the same boundary everything else about this
 * person uses: a clinician with no current access is not told what somebody
 * wrote tonight.
 *
 * The notification names the journal and does **not** quote it. A crisis
 * notification is read in a list, sometimes on a lock screen, and a patient's
 * words about wanting to die do not belong there. The clinician opens the
 * record to read it, which is also where the audit trail records that they did.
 */
async function alertGrantHolders(
  personId: string,
  journalId: string,
  indicators: string[],
): Promise<void> {
  const now = new Date();
  const db = dbFor(await regionOfPerson(personId));

  const holders = await db
    .select({ userId: historyGrants.therapistUserId })
    .from(historyGrants)
    .where(
      and(
        eq(historyGrants.personId, personId),
        eq(historyGrants.status, "granted"),
        gte(historyGrants.expiresAt, now),
      ),
    );

  if (holders.length === 0) return;

  const [person] = await db
    .select({ firstName: people.firstName, lastName: people.lastName })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);

  const name = [person?.firstName, person?.lastName].filter(Boolean).join(" ") || "A patient";

  await db.insert(notifications).values(
    holders.map((holder) => ({
      userId: holder.userId,
      kind: "crisis" as const,
      title: `${name} wrote something that may need a call`,
      body: `A journal entry written just now matched the language we watch for (${indicators.length} phrase${indicators.length === 1 ? "" : "s"}). It is not quoted here on purpose. Open their record to read it.`,
      actionUrl: `/people/${personId}`,
    })),
  );
}

/**
 * What a clinician holding a grant sees. 26.6.
 *
 * The grant check is the caller's job, exactly as it is for documents: this
 * module does not know who is asking, and a data function that decides access
 * from an argument is one somebody eventually passes the wrong argument to.
 */
export async function journalsForClinician(personId: string, limit = 50) {
  const db = dbFor(await regionOfPerson(personId));

  return db
    .select({
      id: journals.id,
      body: journals.body,
      source: journals.source,
      createdAt: journals.createdAt,
      riskLevel: journals.riskLevel,
    })
    .from(journals)
    .where(eq(journals.personId, personId))
    .orderBy(desc(journals.createdAt))
    .limit(limit);
}

/**
 * Journals, laid out for the copilot. PLAN.md 26.6.
 *
 * ## 🔴 What this is, and what it is honestly not yet
 *
 * 26.6 asks for journals to be "cited like a document". Documents carry
 * `[D7:3]` markers the model copies and the UI resolves into an openable
 * passage, and that machinery is document-shaped all the way down:
 * `DocumentRef` is an ordinal and a sequence, and a citation resolves by
 * opening `person_documents`.
 *
 * Generalising that is the clinical evidence layer's job (sprint 33, where
 * every derived fact starts carrying where it came from), and inventing a
 * second half-citation model here would be something 33 has to unpick. So
 * journals reach the copilot as **dated, attributed material the model is told
 * to quote by date**, which is the part that matters clinically, and the
 * clickable marker waits for a citation model that covers both.
 *
 * ⚠️ **Incomplete until sprint 33**, and named as such rather than implied.
 *
 * The `riskLevel` column is deliberately not selected. The copilot must reason
 * from what the patient wrote, not from a keyword scanner's verdict about it:
 * a model told "this entry is high risk" will agree, which is not evidence.
 */
export async function journalContext(
  personId: string,
  opts: { maxChars?: number; limit?: number; before?: Date | null } = {},
): Promise<{ text: string; entries: number }> {
  const maxChars = opts.maxChars ?? 12_000;

  const db = dbFor(await regionOfPerson(personId));

  const rows = await db
    .select({
      body: journals.body,
      source: journals.source,
      createdAt: journals.createdAt,
    })
    .from(journals)
    .where(
      /*
       * 48.4 / C211 — inside the room, nothing written after it opened.
       *
       * A patient journalling on their phone during their own session is not
       * a hypothetical: the app is open in front of them. Without this, the
       * copilot would answer a therapist's question from something the person
       * typed four minutes ago in the same room, which is the live-session
       * reading C211 forbids arriving through a side door.
       */
      opts.before
        ? and(eq(journals.personId, personId), lt(journals.createdAt, opts.before))
        : eq(journals.personId, personId),
    )
    .orderBy(desc(journals.createdAt))
    .limit(opts.limit ?? 40);

  if (rows.length === 0) return { text: "", entries: 0 };

  const parts: string[] = [];
  let used = 0;
  let entries = 0;

  for (const row of rows) {
    const line = `\n=== Journal, ${row.createdAt.toISOString().slice(0, 10)}${row.source === "dictated" ? ", spoken" : ""} ===\n${row.body}`;
    if (used + line.length > maxChars) break;
    parts.push(line);
    used += line.length;
    entries += 1;
  }

  return { text: parts.join("\n"), entries };
}
