import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { DEMO_NOTE, DEMO_TRANSCRIPT } from "@/components/demo/fixtures";
import { db } from "@/lib/db";
import { contentPages } from "@/lib/db/schema";
import { getLocale } from "@/lib/i18n/server";

/**
 * The words inside the live components on the public site. PLAN.md 18.13.
 *
 * ## Why the mockups are content
 *
 * Sprint 21 has to be able to translate the *demonstrations*, not only the
 * paragraphs around them. A homepage that shows a real transcript panel in
 * Arabic with an English conversation inside it is worse than a screenshot:
 * it looks like the product cannot do Arabic, which is the opposite of true.
 *
 * So the demo transcript, the demo brief, the demo homework and the demo
 * profile live in a `content_pages` row (`slug = "demo"`) like everything
 * else, one per locale, and fall back to `components/demo/fixtures.ts` when
 * there is no row — the same two-job arrangement `defaults.ts` has, for the
 * same reason: the marketing site must not go blank because Postgres blinked.
 *
 * ## 🔴 Still synthetic, whatever an admin types
 *
 * 18.11: never a real record. The fallback is invented, and a row here is
 * written by staff in the CMS. Neither path can reach a patient — nothing in
 * this module reads a clinical table, and the components it feeds take their
 * data as props.
 */

export type DemoContent = {
  transcript: { id: string; speaker: "therapist" | "patient"; text: string }[];
  brief: string;
  steps: string[];
  /** The dated observations on the demo profile. */
  observations: { at: string; text: string }[];
  homework: { title: string; detail: string }[];
  patientSessions: { therapist: string; when: string; brief: string | null }[];
};

/** The shipped default. Every word invented; see the file it comes from. */
export const DEMO_FALLBACK: DemoContent = {
  transcript: DEMO_TRANSCRIPT.slice(0, 6).map((line) => ({
    id: line.id,
    speaker: line.speaker === "patient" ? "patient" : "therapist",
    text: line.text,
  })),
  brief: DEMO_NOTE.patientBrief ?? "",
  steps: DEMO_NOTE.patientSteps ?? [],
  observations: [
    { at: "12 March", text: "Sleep disruption returns before performance reviews, twice now." },
    { at: "27 February", text: "Describes the wind-down routine as 'pointless' before trying it." },
    { at: "6 February", text: "First session. Came for sleep; work anxiety surfaced by minute ten." },
  ],
  homework: [
    { title: "Screens down an hour before bed", detail: "Four nights. Pick them now." },
    { title: "Same wake time after a bad night", detail: "The one that does the most work." },
    { title: "Two times, written down", detail: "Roughly asleep, roughly awake. Not a diary." },
  ],
  patientSessions: [
    { therapist: "Dr Nadia Farouk", when: "Tomorrow, 18:00", brief: null },
    {
      therapist: "Dr Nadia Farouk",
      when: "Last Tuesday",
      brief: "You said you would try going to bed earlier, and on the two nights you did it worked.",
    },
  ],
};

/**
 * The demo copy for this reader's language, or the shipped default.
 *
 * Read through the same fallback chain as a page: exact locale, then English,
 * then the constant above. A missing Arabic row is an English demo, never an
 * empty panel.
 */
export async function getDemoContent(): Promise<DemoContent> {
  try {
    /*
     * Inside the try with everything else: `getLocale()` reads a cookie, which
     * throws outside a request (a verifier, a script, a build-time render).
     * The honest answer there is English, not a crash — this is marketing
     * copy, and nothing about it is worth failing a page load for.
     */
    const locale = await getLocale().catch(() => "en" as const);

    const rows = await db
      .select({ locale: contentPages.locale, blocks: contentPages.blocks })
      .from(contentPages)
      .where(
        and(
          eq(contentPages.slug, "demo"),
          eq(contentPages.status, "published"),
          inArray(contentPages.locale, locale === "en" ? ["en"] : [locale, "en"]),
        ),
      );

    const row = rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === "en");
    if (!row) return DEMO_FALLBACK;

    return fromBlocks(row.blocks) ?? DEMO_FALLBACK;
  } catch {
    // The public site never fails because of the CMS. Same rule as defaults.ts.
    return DEMO_FALLBACK;
  }
}

/**
 * A `demo` page's blocks, read as demo copy.
 *
 * Deliberately forgiving: a missing section falls back field by field rather
 * than dropping the whole row, because an admin editing one paragraph of the
 * transcript should not be able to blank the homepage.
 */
function fromBlocks(blocks: unknown): DemoContent | null {
  if (!Array.isArray(blocks)) return null;

  const find = (heading: string) =>
    blocks.find(
      (b): b is { heading?: string; body?: string; items?: { title?: string; body?: string }[] } =>
        typeof b === "object" &&
        b !== null &&
        "heading" in b &&
        String((b as { heading?: string }).heading ?? "").toLowerCase() === heading,
    );

  const transcript = find("transcript");
  const brief = find("brief");
  const homework = find("homework");
  const observations = find("observations");

  return {
    transcript:
      transcript?.items?.map((item, i) => ({
        id: `cms-${i}`,
        // The convention is "who is speaking" in the item title. Anything that
        // is not the patient is the clinician — a demo line with no speaker
        // must never be attributed to the patient by accident.
        speaker: (item.title ?? "").toLowerCase().includes("patient")
          ? ("patient" as const)
          : ("therapist" as const),
        text: item.body ?? "",
      })) ?? DEMO_FALLBACK.transcript,
    brief: brief?.body ?? DEMO_FALLBACK.brief,
    steps: homework?.items?.map((item) => item.title ?? "") ?? DEMO_FALLBACK.steps,
    observations:
      observations?.items?.map((item) => ({ at: item.title ?? "", text: item.body ?? "" })) ??
      DEMO_FALLBACK.observations,
    homework:
      homework?.items?.map((item) => ({ title: item.title ?? "", detail: item.body ?? "" })) ??
      DEMO_FALLBACK.homework,
    patientSessions: DEMO_FALLBACK.patientSessions,
  };
}
