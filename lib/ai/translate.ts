import "server-only";

import { MODELS, logUsage, openai, parseJson } from "./client";
import { log, safeErrorMessage } from "@/lib/logger";

/**
 * Machine translation of interface strings. PLAN.md 21.16, 21.17, 21.19.
 *
 * ## 🔴 What this is allowed to produce
 *
 * Drafts. Only drafts. Nothing in this module can publish, and its caller
 * (`draftTranslations`) writes `status = 'draft'` with the model name attached
 * — because a language that went live on a machine's judgement is a language
 * where a mistranslated sentence can be a clinical instruction and nobody
 * decided it should say that.
 *
 * ## Why the prompt is this careful
 *
 * Interface strings are not prose. They carry placeholders (`{name}`), they
 * are read in a hurry by somebody in distress, and several of them are safety
 * copy. The three rules in the prompt are the three ways a translation of a
 * *product* goes wrong: a lost placeholder renders `{name}` on screen, an
 * expanded sentence breaks a button, and a softened crisis line stops being an
 * instruction.
 */

const SYSTEM = `You translate interface strings for a mental-health product used in Egypt and the Gulf.

Rules, in order of importance:

1. Keep every placeholder exactly as written. {name}, {count}, {date} must appear in your output unchanged. A lost placeholder renders as literal text on somebody's screen.
2. Match the register of the English: plain, short, direct. These are buttons, labels and one-line messages, not marketing copy. If the English is five words, five words is the target, a translation twice as long breaks the button it sits in.
3. Crisis, consent and recording strings are instructions. Translate them as instructions. Do not soften, hedge, or make them polite at the cost of being clear.

Arabic is Modern Standard, addressed to a Gulf reader, using Western digits.

Return JSON: an object mapping each key to its translation, and nothing else. If you cannot translate a string faithfully, omit the key rather than guessing.`;

export type TranslateResult = {
  translations?: Record<string, string>;
  model?: string;
  error?: string;
};

export async function translateStrings(input: {
  locale: string;
  strings: Record<string, string>;
  organizationId?: string | null;
  userId?: string | null;
}): Promise<TranslateResult> {
  const entries = Object.entries(input.strings).filter(([, value]) => Boolean(value));
  if (entries.length === 0) return { translations: {}, model: MODELS.note };

  const started = Date.now();

  try {
    const completion = await openai().chat.completions.create({
      model: MODELS.note,
      // Zero. There is no creative latitude in "what does this button say".
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: 4000,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Target language: ${input.locale}\n\nStrings:\n${JSON.stringify(
            Object.fromEntries(entries),
            null,
            1,
          )}`,
        },
      ],
    });

    await logUsage({
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      sessionId: null,
      kind: "translate",
      model: MODELS.note,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      durationMs: Date.now() - started,
      status: "success",
    });

    const raw = parseJson<Record<string, unknown>>(
      completion.choices[0]?.message?.content,
      {},
      "translate",
    );

    /*
     * 🔴 A translation that dropped a placeholder is discarded, not stored.
     *
     * `{name}` rendering literally on a screen is the most visible way a
     * machine translation fails, and it is trivially checkable here — so the
     * check happens here rather than in a reviewer's eyes at the end of two
     * hundred strings.
     */
    const translations: Record<string, string> = {};
    let dropped = 0;

    for (const [key, english] of entries) {
      const value = raw[key];
      if (typeof value !== "string" || value.trim() === "") continue;

      const placeholders = [...english.matchAll(/\{(\w+)\}/g)].map((m) => m[0]);
      const kept = placeholders.every((token) => value.includes(token));
      if (!kept) {
        dropped += 1;
        continue;
      }

      translations[key] = value.trim();
    }

    if (dropped > 0) {
      log.warn("translations discarded for lost placeholders", {
        locale: input.locale,
        dropped,
      });
    }

    return { translations, model: MODELS.note };
  } catch (error) {
    log.error("translation failed", {
      locale: input.locale,
      reason: safeErrorMessage(error),
    });
    return { error: "The translation service did not answer. Nothing was saved." };
  }
}
