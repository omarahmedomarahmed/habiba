/**
 * Turning what happened into what the forecast runs on.
 *
 * 🔴 **The only file in `lib/finance/` that touches the database**, and it only
 * reads. `model.ts` is pure and stays pure; this is the seam between rows and
 * arithmetic, and keeping it to one file is what makes "the forecast cannot
 * charge anybody" a property of the module graph rather than a promise.
 *
 * ## What it measures, and what it refuses to
 *
 * It measures the things three months and twenty-two people can actually
 * establish: what a session costs, how often patients consent to recording,
 * what the product's own fee settings are, how many sessions a patient has.
 *
 * It does **not** measure churn, conversion, payment fees or salaries, and it
 * does not pretend to. Those stay `assumed`, they carry that label onto the
 * screen, and every figure derived from them inherits it.
 *
 * ## A measurement is a snapshot, not a view
 *
 * `take()` produces a plain object that gets written to `finance_benchmarks`
 * and never updated. Re-measuring writes a new row. A forecast quoted in March
 * can be reproduced in June because the numbers behind it were frozen, which is
 * the whole reason the table exists.
 */
import "server-only";

import { sql } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";

import { assumed, measured, type Input } from "./assumptions";

export type Measured = {
  label: string;
  takenOn: string;
  /** What the database held, so a reader can judge the sample rather than trust it. */
  source: {
    completedSessions: number;
    therapists: number;
    patients: number;
    aiCalls: number;
    audioMinutes: number;
    monthsOfHistory: number;
  };
  inputs: {
    aiFixedUsdPerSession: Input;
    aiPerMinuteUsd: Input;
    recordingConsentRate: Input;
    platformFeeCents: Input;
    platformFeeBps: Input;
    aiFeeUsdPerSession: Input;
    patientsPerTherapist: Input;
    sessionsPerPatientPerMonth: Input;
  };
  /** Anything the measurement could not establish, named rather than defaulted. */
  couldNotMeasure: string[];
};

/**
 * Take a measurement from whatever database `DATABASE_URL` names.
 *
 * `fallback` supplies the two-term AI cost when the rows cannot produce it,
 * which is the case on any database whose sessions are all the same length.
 * `lib/finance/physics.ts` refuses to fit one cluster, and this respects that
 * refusal rather than routing around it.
 */
export async function take(opts: {
  label: string;
  fallbackAiFixedUsd: number;
  fallbackAiPerMinuteUsd: number;
}): Promise<Measured> {
  const today = new Date().toISOString().slice(0, 10);
  const couldNotMeasure: string[] = [];

  /* ------------------------------------------------------------- the shape -- */

  const shape = await db.execute<{
    sessions: string;
    therapists: string;
    patients: string;
    ai_calls: string;
    audio_seconds: string;
    months: string;
  }>(sql`
    SELECT (SELECT COUNT(*) FROM sessions WHERE status = 'completed')::text AS sessions,
           (SELECT COUNT(*) FROM users WHERE role = 'therapist' AND deleted_at IS NULL)::text AS therapists,
           (SELECT COUNT(*) FROM patients WHERE deleted_at IS NULL)::text AS patients,
           (SELECT COUNT(*) FROM ai_request_logs)::text AS ai_calls,
           (SELECT COALESCE(SUM(audio_seconds), 0) FROM ai_request_logs)::text AS audio_seconds,
           COALESCE((SELECT GREATEST(1, CEIL(EXTRACT(EPOCH FROM (max(created_at) - min(created_at))) / 2629800.0))
                       FROM sessions), 1)::text AS months`);

  const s = shape.rows[0]!;
  const sessions = Number(s.sessions);
  const therapists = Number(s.therapists);
  const patients = Number(s.patients);
  const months = Math.max(1, Number(s.months));

  /* ------------------------------------------------------ the cost, fitted -- */

  const { fit, costAt } = await import("./physics");
  const { getSettings } = await import("@/lib/settings");
  const settings = await getSettings();

  const perSession = await db.execute<{
    session_id: string;
    minutes: string;
    input_tokens: string;
    output_tokens: string;
    audio_seconds: string;
    microcents: string;
  }>(sql`
    WITH duration AS (
      SELECT session_id, SUM(audio_seconds) / 60.0 AS minutes
        FROM ai_request_logs
       WHERE session_id IS NOT NULL AND kind = 'transcribe'
       GROUP BY session_id
    )
    SELECT l.session_id::text AS session_id,
           d.minutes::text AS minutes,
           SUM(l.input_tokens)::text AS input_tokens,
           SUM(l.output_tokens)::text AS output_tokens,
           SUM(l.audio_seconds)::text AS audio_seconds,
           SUM(l.cost_microcents)::text AS microcents
      FROM ai_request_logs l
      JOIN duration d ON d.session_id = l.session_id
     WHERE l.status = 'success'
     GROUP BY l.session_id, d.minutes`);

  const samples = perSession.rows.map((r) => ({
    sessionId: r.session_id,
    minutes: Number(r.minutes),
    inputTokens: Number(r.input_tokens),
    outputTokens: Number(r.output_tokens),
    audioSeconds: Number(r.audio_seconds),
    microcents: Number(r.microcents),
  }));

  const f = fit(samples);

  /*
   * 🔴 A blended rate, because this fit is over every kind at once. It is right
   * for a headline and wrong for a breakdown, and `npm run physics` is the tool
   * that does it per kind. Stated here rather than hidden.
   */
  const rates = {
    inPerMTok: settings.aiRates.tokens[0]?.inPerMTok ?? 250,
    outPerMTok: settings.aiRates.tokens[0]?.outPerMTok ?? 1000,
    perAudioMinute: settings.aiRates.audio[0]?.perAudioMinute ?? 0.3,
  };

  let aiFixed: Input;
  let aiPerMinute: Input;

  const atZero = f.fitted ? costAt(f, 0, rates) : null;
  const atOne = f.fitted ? costAt(f, 1, rates) : null;

  if (f.fitted && atZero !== null && atOne !== null) {
    aiFixed = measured(atZero / 100_000, "Fitted intercept over the sessions on this database", today, f.samples);
    aiPerMinute = measured(
      (atOne - atZero) / 100_000,
      "Fitted slope over the sessions on this database",
      today,
      f.samples,
    );
  } else {
    /*
     * 🔴 The refusal is respected rather than routed around. A database whose
     * sessions are all one length cannot separate the two terms, so the
     * benchmark falls back to the figures measured against the live API on
     * 2026-09-14 and SAYS it did.
     */
    couldNotMeasure.push(
      f.fitted ? "the AI cost fit produced no usable line" : `the AI cost: ${f.reason}`,
    );
    aiFixed = assumed(opts.fallbackAiFixedUsd, "From the 2026-09-14 API benchmark, because this database could not be fitted");
    aiPerMinute = assumed(opts.fallbackAiPerMinuteUsd, "From the 2026-09-14 API benchmark, because this database could not be fitted");
  }

  /* --------------------------------------------------------- the consent -- */

  const consent = await db.execute<{ total: string; on: string }>(sql`
    SELECT COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE recording_consent = 'granted')::text AS on
      FROM sessions WHERE status = 'completed'`);

  const total = Number(consent.rows[0]?.total ?? 0);
  const granted = Number(consent.rows[0]?.on ?? 0);

  const consentInput =
    total > 0
      ? measured(granted / total, `${granted} of ${total} completed sessions had recording on`, today, total)
      : (couldNotMeasure.push("the recording consent rate: no completed sessions"),
        assumed(0.7, "No completed sessions to measure"));

  /* ------------------------------------------- the prices, read not invented */

  const payg = settings.pricing.tiers.find((t) => t.key === "payg");

  return {
    label: opts.label,
    takenOn: today,
    source: {
      completedSessions: sessions,
      therapists,
      patients,
      aiCalls: Number(s.ai_calls),
      audioMinutes: Math.round(Number(s.audio_seconds) / 60),
      monthsOfHistory: months,
    },
    inputs: {
      aiFixedUsdPerSession: aiFixed,
      aiPerMinuteUsd: aiPerMinute,
      recordingConsentRate: consentInput,
      platformFeeCents: measured(
        settings.session.platformFeeCents,
        "platform_settings.session.platformFeeCents, read not invented",
        today,
        1,
      ),
      platformFeeBps: measured(
        settings.session.platformFeeBps,
        "platform_settings.session.platformFeeBps",
        today,
        1,
      ),
      aiFeeUsdPerSession: measured(
        (payg?.aiRateCents ?? 300) / 100,
        "platform_settings.pricing, the pay as you go AI rate",
        today,
        1,
      ),
      patientsPerTherapist:
        therapists > 0
          ? measured(patients / therapists, `${patients} patients across ${therapists} therapists`, today, patients)
          : (couldNotMeasure.push("patients per therapist: no therapists"),
            assumed(12, "No therapists on this database")),
      sessionsPerPatientPerMonth:
        patients > 0 && months > 0
          ? measured(
              sessions / patients / months,
              `${sessions} sessions, ${patients} patients, ${months} months`,
              today,
              sessions,
            )
          : (couldNotMeasure.push("sessions per patient per month: no patients"),
            assumed(2, "No patients on this database")),
    },
    /*
     * 🔴 The standing list, appended to whatever happened above. These four can
     * never be measured by a three-month simulation and the screen has to keep
     * saying so, because a forecast that quietly fills them in is the failure
     * this whole provenance system exists to prevent.
     */
    couldNotMeasure: [
      ...couldNotMeasure,
      "therapist churn: three months and one cohort cannot establish it",
      "acquisition cost and conversion: there is no marketing in the simulation",
      "payment processing fees: Stripe runs in test mode and charges nothing",
      "video cost: Daily bills per participant-minute and the invoice is not in this database",
    ],
  };
}
