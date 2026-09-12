import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { classifyRisk } from "@/lib/ai/risk";
import { logUsage } from "@/lib/ai/client";
import { levelFor, recommendedAction, shouldAlert } from "@/lib/crisis/level";
import { raiseCrisisAlert, scanForCrisisLanguage } from "@/lib/crisis/alerts";
import { dbFor } from "@/lib/db";
import { regionOfOrganization, regionOfPatient } from "@/lib/db/directory";
import { riskAssessments, transcriptSegments } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";

/**
 * 🔴 30.1 / C154 — ROUTED, not pinned. The region comes from the PATIENT.
 *
 * The first version of this module pinned to the default region and the pin
 * ratchet caught it at 86, up from 85. It did not need to: `finishSession`
 * hands over the patient, and a session with no patient row (a join link
 * nobody has named yet) belongs to the practice that held it. Both are
 * resolvable, so both are resolved.
 *
 * C154 is the reason it is the patient first and the organisation only as a
 * fallback: an Egyptian patient of an American clinician is the ordinary case
 * here, and routing their session on the practice would put an Egyptian
 * person's risk assessment in the wrong country while every test passed.
 */
async function regionFor(patientId: string | null, organizationId: string) {
  return patientId ? regionOfPatient(patientId) : regionOfOrganization(organizationId);
}

/**
 * The whole of sprint 35, in one function. PLAN.md 35.1 to 35.3.
 *
 * ## 🔴 Three separations, and each one is load-bearing
 *
 * **The model reads the session and nothing else** (C170). It is handed a
 * transcript. Prior risk assessments, the chart, the evidence layer and the
 * summary are all available two lines from here and none of them is passed,
 * because sprint 34 measured what happens when prior context sits beside fresh
 * observation: the note followed the prior fact in five cases out of five. The
 * same failure here reads *"no acute risk, consistent with the record"* on the
 * session where somebody said they had written letters to their family.
 *
 * **The model does not decide the level.** It returns indicators with quotes;
 * `levelFor` turns those into a level by arithmetic somebody can read.
 *
 * **The keyword list is a floor, not an input.** It is scanned here, first,
 * and its level is computed before the model is called. A model outage, a
 * parse failure, a bad day: none of them can produce an alert quieter than the
 * one the old, dumber system would have raised.
 *
 * ## What is deliberately untouched (35.3)
 *
 * `raiseCrisisAlert` is called exactly as the keyword path calls it. Dedup,
 * the pending-then-delivered write ordering, the notification and the sweeper
 * cron are not modified, not wrapped and not bypassed. The seam was built in
 * sprint 3 and has been waiting; this fills it rather than replacing it.
 */
export async function assessSessionRisk(opts: {
  sessionId: string;
  organizationId: string;
  therapistId: string;
  patientId: string | null;
  locale?: string;
}): Promise<{ level: string; findings: number; unquoted: number } | null> {
  const db = dbFor(await regionFor(opts.patientId, opts.organizationId));

  const rows = await db
    .select({ speaker: transcriptSegments.speaker, text: transcriptSegments.text })
    .from(transcriptSegments)
    .where(eq(transcriptSegments.sessionId, opts.sessionId))
    .orderBy(asc(transcriptSegments.sequence))
    .limit(1200);

  if (rows.length === 0) return null;

  const transcript = rows
    .map(
      (row) =>
        `${row.speaker === "patient" ? "Patient" : row.speaker === "therapist" ? "Therapist" : "Speaker"}: ${row.text}`,
    )
    .join("\n");

  /*
   * 🔴 The floor first, before the model is called at all.
   *
   * Order matters more than it looks. Computing this after the classification
   * would work today and would be one refactor away from a code path where a
   * thrown error skips it — and the error case is precisely when the floor is
   * the only thing left.
   */
  const patientText = rows
    .filter((row) => row.speaker !== "therapist")
    .map((row) => row.text)
    .join("\n");
  const hits = scanForCrisisLanguage(patientText);

  const started = Date.now();
  let classification: Awaited<ReturnType<typeof classifyRisk>> | null = null;

  try {
    classification = await classifyRisk(transcript);
    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.therapistId,
      sessionId: opts.sessionId,
      kind: "risk",
      model: classification.model,
      inputTokens: classification.inputTokens,
      outputTokens: classification.outputTokens,
      durationMs: Date.now() - started,
      status: "success",
    });
  } catch (error) {
    /*
     * 🔴 The classifier failing must not make the session quieter than it was
     * before sprint 35 existed. The floor stands on its own.
     */
    log.warn("risk classification unavailable, falling back to the keyword floor", {
      session: ref(opts.sessionId),
      reason: safeErrorMessage(error),
    });
  }

  const findings = classification?.findings ?? [];
  const level = levelFor(findings, hits);

  if (!shouldAlert(level)) {
    return { level, findings: findings.length, unquoted: classification?.unquoted ?? 0 };
  }

  await raiseCrisisAlert({
    sessionId: opts.sessionId,
    organizationId: opts.organizationId,
    therapistId: opts.therapistId,
    patientId: opts.patientId,
    level: level as never,
    /*
     * `keyword` when the model added nothing, `model` when it did. The source
     * has to describe what actually produced the finding, or the column that
     * exists to tell a clinician where an alert came from is decoration.
     */
    source: findings.length > 0 ? "model" : "keyword",
    indicators: findings.length > 0 ? findings.map((f) => f.indicator) : hits,
    recommendedAction: recommendedAction(level, opts.locale) ?? undefined,
  });

  /*
   * The evidence goes onto the row the alert just wrote. A second statement
   * rather than a wider `raiseCrisisAlert` signature, because 35.3 says that
   * function's behaviour is untouched: the write ordering it guards (pending
   * before notify, delivered after) is the thing a wider signature would
   * eventually disturb.
   */
  if (classification) {
    /*
     * 🔴 The NEWEST row, not the oldest.
     *
     * `raiseCrisisAlert` dedups inside ten minutes, so the row this evidence
     * belongs to is either the one it just wrote or the one it deduped
     * against — in both cases the most recent. Taking the oldest would attach
     * today's quotes to an alert raised earlier in the session by the phrase
     * list, which is a clinician reading the wrong sentence under the right
     * label.
     */
    const [latest] = await db
      .select({ id: riskAssessments.id })
      .from(riskAssessments)
      .where(eq(riskAssessments.sessionId, opts.sessionId))
      .orderBy(desc(riskAssessments.createdAt))
      .limit(1);

    if (latest) {
      await db
        .update(riskAssessments)
        .set({
          findings,
          model: classification.model,
          unquotedFindings: classification.unquoted,
          source: findings.length > 0 ? "model" : "keyword",
        })
        .where(eq(riskAssessments.id, latest.id));
    }
  }

  return { level, findings: findings.length, unquoted: classification?.unquoted ?? 0 };
}

/**
 * The assessment on this session, for the clinician's screen.
 *
 * Scoped to the actor's organisation, like every other clinical read: the
 * session id in a URL is not access.
 */
export async function latestAssessment(
  sessionId: string,
  actor: { organizationId: string },
  patientId: string | null = null,
): Promise<{
  level: string;
  source: "keyword" | "model";
  findings: { indicator: string; quote: string; confidence: number }[];
  indicators: string[];
  recommendedAction: string | null;
  unquotedFindings: number;
} | null> {
  const db = dbFor(await regionFor(patientId, actor.organizationId));

  const [row] = await db
    .select({
      level: riskAssessments.level,
      source: riskAssessments.source,
      findings: riskAssessments.findings,
      indicators: riskAssessments.indicators,
      recommendedAction: riskAssessments.recommendedAction,
      unquotedFindings: riskAssessments.unquotedFindings,
    })
    .from(riskAssessments)
    .where(
      and(
        eq(riskAssessments.sessionId, sessionId),
        eq(riskAssessments.organizationId, actor.organizationId),
      ),
    )
    .orderBy(desc(riskAssessments.createdAt))
    .limit(1);

  return row ?? null;
}

/**
 * 🔴 What the CLINICIAN sees beside the alert, and the model never does.
 *
 * The founder's instruction for this sprint, and the direct consequence of
 * sprint 34's measurement: prior risk history is exactly the context a person
 * needs to judge an alert and exactly the context that makes a model write
 * "consistent with the record". So it is fetched here, on the clinician's
 * screen, at display time, in a function the classifier does not import and
 * cannot reach.
 *
 * Ordered newest first and capped, because the question a clinician is asking
 * is "has this happened before, and when", not "show me everything".
 */
export async function priorRiskFor(
  sessionId: string,
  therapistId: string,
  organizationId: string,
  limit = 5,
): Promise<{ level: string; createdAt: Date; indicators: string[]; source: string }[]> {
  const db = dbFor(await regionOfOrganization(organizationId));

  const rows = await db
    .select({
      level: riskAssessments.level,
      createdAt: riskAssessments.createdAt,
      indicators: riskAssessments.indicators,
      source: riskAssessments.source,
      sessionId: riskAssessments.sessionId,
    })
    .from(riskAssessments)
    .where(eq(riskAssessments.therapistId, therapistId))
    .orderBy(asc(riskAssessments.createdAt));

  return rows
    .filter((row) => row.sessionId !== sessionId)
    .reverse()
    .slice(0, limit)
    .map(({ sessionId: _ignored, ...row }) => row);
}
