/*
 * 🔴 30.1 — the CONTROL PLANE: the model client reads platform settings and spend caps.
 */
import "server-only";

import OpenAI from "openai";

import { controlDb as db} from "@/lib/db";
import { aiRequestLogs } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref, safeErrorMessage } from "@/lib/logger";

/**
 * One gateway for every model call.
 *
 * Two rules it exists to enforce:
 *  - Usage is logged as *metadata only*. Prompts and completions are transcript
 *    text; storing them would duplicate the chart into a usage table.
 *  - There is no mock fallback. The old gateway returned a fabricated SOAP note
 *    when no API key was configured, and logged it with `status: 'success'` —
 *    one missing environment variable away from inventing clinical content.
 */

export const MODELS = {
  transcribe: "gpt-4o-mini-transcribe",
  note: "gpt-4o",
  risk: "gpt-4o",
  // In-session suggestions run many times per session; the small model keeps
  // that affordable and is more than adequate for a one-line prompt.
  copilot: "gpt-4o-mini",
} as const;

/**
 * Rough public rates, in cents. Used for the admin usage dashboard and for the
 * margin figure the pricing tiers are set against.
 *
 * Keyed by the exact model string we send, so that adding a model means adding
 * a rate rather than silently inheriting somebody else's — see
 * `estimateCostMicrocents`.
 */
type TokenRate = { inPerMTok: number; outPerMTok: number };
type AudioRate = { perAudioMinute: number };

/**
 * 🔴 49.14b — the SHIPPED rates, and no longer the only ones.
 *
 * These moved into `platform_settings.aiRates`, so a provider changing a price
 * is an edit rather than a deploy. They stay here as the floor: a settings row
 * that cannot be parsed falls back to exactly these, because an empty rate
 * table silently reprices the entire product.
 *
 * `cost_microcents` is still frozen on the row at write time, so changing a
 * rate prices the NEXT call and never rewrites history.
 */
const TOKEN_RATES: Record<string, TokenRate> = {
  "gpt-4o": { inPerMTok: 250, outPerMTok: 1000 },
  "gpt-4o-mini": { inPerMTok: 15, outPerMTok: 60 },
};

const AUDIO_RATES: Record<string, AudioRate> = {
  "gpt-4o-mini-transcribe": { perAudioMinute: 0.3 },
  // Whisper is not wired up, but its rate is public and being here is what
  // makes switching to it a configuration change rather than a silent
  // mispricing.
  "whisper-1": { perAudioMinute: 0.6 },
};

/**
 * The rate to use when a model has none.
 *
 * Deliberately the *most expensive* rate in each table rather than zero. A
 * model we forgot to price must overstate the cost, because an overstatement
 * shows up as a margin that looks too thin and gets investigated, while a zero
 * shows up as free and gets believed. This is the failure mode H12 describes,
 * and the fallback is the belt to the fix's braces.
 */
function dearestTokenRate(table: Record<string, TokenRate> = TOKEN_RATES): TokenRate {
  const rows = Object.values(table);
  if (rows.length === 0) return dearestTokenRate(TOKEN_RATES);
  return rows.reduce((a, b) => (b.inPerMTok > a.inPerMTok ? b : a));
}

function dearestAudioRate(table: Record<string, AudioRate> = AUDIO_RATES): AudioRate {
  const rows = Object.values(table);
  if (rows.length === 0) return dearestAudioRate(AUDIO_RATES);
  return rows.reduce((a, b) => (b.perAudioMinute > a.perAudioMinute ? b : a));
}

let client: OpenAI | null = null;

export function openai(): OpenAI {
  if (!env.openaiApiKey) {
    throw new AiUnavailableError("OPENAI_API_KEY is not configured");
  }
  client ??= new OpenAI({
    apiKey: env.openaiApiKey,
    // Lets the whole pipeline be pointed at a mock for end-to-end testing, or
    // at an Azure/proxy endpoint later. Unset in normal operation.
    ...(env.openaiBaseUrl ? { baseURL: env.openaiBaseUrl } : {}),
    maxRetries: 2,
    timeout: 120_000,
  });
  return client;
}

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/**
 * Every kind of model call, including the three that were missing.
 *
 * The union used to be four values while five call sites existed, so the
 * patient-facing copilot and the note translation pass logged themselves as
 * something else. A total stays right when a category is mislabelled, which
 * is exactly why nobody notices until they try to break spend down per
 * therapist and the numbers refuse to add up.
 */
export type UsageKind =
  | "transcribe"
  | "note"
  | "diarise"
  | "risk"
  | "copilot"
  | "patient_copilot"
  | "translate"
  | "speech"
  /** Reading a diagnosis out of an uploaded document (8.9). */
  | "diagnosis"
  /** Rebuilding a person's rolling profile and timeline (9.1). */
  | "profile";

type UsageInput = {
  organizationId: string | null;
  userId: string | null;
  sessionId: string | null;
  /**
   * 49.14a — who the call was ABOUT. Optional because several kinds genuinely
   * concern nobody: a translation of a CMS page, a speech synthesis of an
   * admin string. Absent is a real answer and is recorded as such (49.14c).
   */
  patientId?: string | null;
  kind: UsageKind;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  audioSeconds?: number;
  durationMs: number;
  status: "success" | "error";
  errorCode?: string;
};

export async function logUsage(input: UsageInput): Promise<void> {
  const microcents = estimateCostMicrocents(input, await ratesInForce());
  try {
    await db.insert(aiRequestLogs).values({
      organizationId: input.organizationId,
      userId: input.userId,
      sessionId: input.sessionId,
      patientId: input.patientId ?? null,
      kind: input.kind,
      model: input.model,
      inputTokens: input.inputTokens ?? 0,
      outputTokens: input.outputTokens ?? 0,
      audioSeconds: input.audioSeconds ?? 0,
      // Kept in step for anything still reading it, and still lossy — see the
      // note on `estimateCostMicrocents`.
      costCents: Math.round(microcents / 1000),
      costMicrocents: microcents,
      durationMs: input.durationMs,
      status: input.status,
      errorCode: input.errorCode ?? null,
    });
  } catch (error) {
    // Usage accounting must never take down a clinical request.
    log.warn("ai usage log failed", { reason: safeErrorMessage(error) });
  }
}

/**
 * Cost in thousandths of a cent.
 *
 * This function used to return whole cents, and that single `Math.round` made
 * the entire spend ledger read zero. The real numbers are far below one cent:
 * a thirty-second transcription chunk is 0.15 cents, a gpt-4o-mini copilot
 * call about 0.014. Both rounded to nothing, and since chunks are by far the
 * highest-volume call, essentially all transcription spend was invisible —
 * 115 calls and 902 seconds of audio recorded as $0.00.
 *
 * It was not a small error in a number. It was a ledger that ran on every
 * request, cost a database write each time, and reported nothing — the kind
 * of instrumentation that is worse than none, because its existence stops
 * anyone looking for the missing figure.
 *
 * Integers rather than floats: money in floating point reintroduces the same
 * family of bug in a form that is harder to see.
 */
/**
 * Only the fields that decide the price.
 *
 * Narrower than `UsageInput` on purpose: costing must not be able to depend on
 * who ran the call or how long it took, and a test should not have to invent an
 * organisation id to check an arithmetic rate.
 */
type CostInput = Pick<UsageInput, "kind" | "model" | "inputTokens" | "outputTokens" | "audioSeconds">;

/** The rate tables in force, from settings, falling back to the shipped ones. */
type Rates = { tokens: Record<string, TokenRate>; audio: Record<string, AudioRate> };

const SHIPPED: Rates = { tokens: TOKEN_RATES, audio: AUDIO_RATES };

/**
 * 49.14b — read once per call, from settings.
 *
 * `getSettings` is cached, so this is not a query per model call. It is
 * deliberately not cached HERE: a rate an operator corrects at nine o'clock
 * should price the ten o'clock call, and a second cache in front of a cached
 * read is a stale price nobody can explain.
 *
 * Failure falls back to the shipped table rather than to nothing, for the
 * reason in `dearestTokenRate` one level down: a missing price must overstate,
 * never zero.
 */
async function ratesInForce(): Promise<Rates> {
  try {
    const { getSettings } = await import("@/lib/settings");
    const { aiRates } = await getSettings();
    return {
      tokens: Object.fromEntries(
        aiRates.tokens.map((r) => [r.model, { inPerMTok: r.inPerMTok, outPerMTok: r.outPerMTok }]),
      ),
      audio: Object.fromEntries(
        aiRates.audio.map((r) => [r.model, { perAudioMinute: r.perAudioMinute }]),
      ),
    };
  } catch {
    return SHIPPED;
  }
}

function estimateCostMicrocents(input: CostInput, rates: Rates = SHIPPED): number {
  if (input.kind === "transcribe") {
    /*
     * H12, fixed.
     *
     * This line used to be `RATES["gpt-4o-mini-transcribe"]` — a hardcoded
     * lookup that ignored `input.model` entirely. Every transcription was
     * costed at the mini rate no matter which model actually ran, so pointing
     * transcription at a second provider or a larger model would have kept
     * billing the cheap one, silently and forever, with nothing in the data to
     * show it. The hazard note is explicit that this had to be fixed *before* a
     * second provider existed, because afterwards the wrong figures are already
     * in the ledger and indistinguishable from right ones.
     *
     * The token branch below always did read `input.model`; it just did it with
     * a ternary that treated everything that was not `gpt-4o-mini` as `gpt-4o`,
     * which has the same shape of bug one model away. Both branches now look
     * the model up, and both fall back loudly rather than cheaply.
     */
    const rate = rates.audio[input.model] ?? dearestAudioRate(rates.audio);
    return Math.round(((input.audioSeconds ?? 0) / 60) * rate.perAudioMinute * 1000);
  }

  const rate = rates.tokens[input.model] ?? dearestTokenRate(rates.tokens);
  const inCost = ((input.inputTokens ?? 0) / 1_000_000) * rate.inPerMTok;
  const outCost = ((input.outputTokens ?? 0) / 1_000_000) * rate.outPerMTok;
  return Math.round((inCost + outCost) * 1000);
}

/** Exported for the cost test — the arithmetic, without a database. */
export const __costing = { estimateCostMicrocents, TOKEN_RATES, AUDIO_RATES };

/**
 * Parse a model response that is supposed to be JSON.
 *
 * `response_format: json_object` makes this reliable but not guaranteed, and a
 * model that decides to wrap its answer in a code fence should degrade to a
 * typed fallback rather than throw inside a clinical path. Every JSON.parse of
 * model output in the old codebase needed this; several did not have it.
 */
export function parseJson<T>(raw: string | null | undefined, fallback: T, context: string): T {
  if (!raw) return fallback;
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object") return fallback;
    return parsed as T;
  } catch {
    log.warn("model returned unparseable JSON", { context });
    return fallback;
  }
}

export { ref };
