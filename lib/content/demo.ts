/*
 * 🔴 30.1 — the CONTROL PLANE. One copy, read by every region.
 *
 * This module reads facts about the PRODUCT rather than about a person:
 * settings, content, taxonomy, language, the operator console. There is one
 * of each and Cairo reads the same rows as Virginia. The compiler would not
 * let this file compile without making that choice explicitly.
 */
import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { DEMO_NOTE, DEMO_TRANSCRIPT } from "@/components/demo/fixtures";
import { controlDb as db } from "@/lib/db";
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
  /** 28.6 — the versioned summary, with the clinician behind each version. */
  summaryVersions: { version: number; author: string; on: string; body: string }[];
  /** 28.6 — what the person wrote themselves, between sessions. */
  journalEntries: { on: string; text: string }[];
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
  /*
   * 🔴 Two clinicians, deliberately. One version would demonstrate a summary;
   * two with different names on them demonstrate the thing that is actually
   * hard, which is that moving practice does not start you again.
   */
  summaryVersions: [
    {
      version: 2,
      author: "Dr Youssef Bakr",
      on: "4 June",
      body: "Picking up from Dr Farouk. Sleep is steadier and the work anxiety underneath it is what we are on now. You said the reviews are the trigger rather than the job, which is worth holding on to.",
    },
    {
      version: 1,
      author: "Dr Nadia Farouk",
      on: "18 March",
      body: "You came about sleep and we found the pattern around performance reviews within two sessions. The wind-down routine helps on the nights you keep it. Handing over because you are moving cities, not because anything went wrong.",
    },
  ],
  journalEntries: [
    { on: "2 June", text: "Slept through for the first time in about three weeks. Nothing special happened, which is the annoying part." },
    { on: "29 May", text: "Bad one. Kept rehearsing the review in my head until about two. Did the breathing, it helped a bit, not much." },
  ],
};

/**
 * 🔴 The Arabic fallback. PLAN.md 28.1, closing most of 22R.10.
 *
 * There is no `demo` row in `content_pages` and there never has been, so every
 * demonstration on the Arabic pages was falling through to the English
 * constant above: an Arabic page showing a transcript panel with an English
 * conversation inside it. 21R recorded that as 42 English passages remaining
 * and left it, correctly, because writing an Arabic transcript is writing
 * rather than translating.
 *
 * This is that writing. The people, the session and the week are invented, as
 * they are in the English one, and the conversation is written as Arabic
 * rather than rendered from the English sentences: an Egyptian patient does
 * not describe insomnia in translated English syntax.
 *
 * An admin can still override any of it from the CMS. This is the floor.
 */
export const DEMO_FALLBACK_AR: DemoContent = {
  transcript: [
    { id: "ar-1", speaker: "therapist", text: "طيب، حكيلي عن النوم الأسبوع ده." },
    { id: "ar-2", speaker: "patient", text: "بنام بالعافية. بفضل مستني الساعة تبقى تلاتة وأنا صاحي." },
    { id: "ar-3", speaker: "therapist", text: "وبيحصل ده كل ليلة، ولا في ليالي بعينها؟" },
    { id: "ar-4", speaker: "patient", text: "الأحد والاتنين أوحش حاجة. يوم التقييم في الشغل يوم التلات." },
    { id: "ar-5", speaker: "therapist", text: "ده أول مرة نقول فيها إن التقييم قبل النوم مش بعده." },
    { id: "ar-6", speaker: "patient", text: "أيوه. أنا مكنتش واخد بالي إن ده نفس النمط." },
  ],
  brief:
    "اتكلمنا النهاردة عن النوم، ولقينا إن أسوأ ليلتين هما اللي قبل التقييم في الشغل. اتفقنا تجرب تسيب الموبايل ساعة قبل ما تنام، أربع ليالي بس، وتصحى في نفس الميعاد حتى لو الليلة كانت وحشة.",
  steps: [
    "الموبايل بعيد ساعة قبل النوم، أربع ليالي",
    "نفس ميعاد الصحيان حتى بعد ليلة وحشة",
    "تكتب ميعادين تقريبيين: نمت امتى، صحيت امتى",
  ],
  observations: [
    { at: "١٢ مارس", text: "النوم بيتقطع قبل التقييم في الشغل، للمرة التانية." },
    { at: "٢٧ فبراير", text: "بيوصف روتين ما قبل النوم بأنه «ملوش لازمة» قبل ما يجربه." },
    { at: "٦ فبراير", text: "أول جلسة. جه بسبب النوم، وقلق الشغل ظهر في أول عشر دقايق." },
  ],
  homework: [
    { title: "الموبايل بعيد ساعة قبل النوم", detail: "أربع ليالي. اختارهم دلوقتي." },
    { title: "نفس ميعاد الصحيان بعد الليلة الوحشة", detail: "دي اللي بتعمل الشغل كله." },
    { title: "ميعادين مكتوبين", detail: "نمت امتى تقريبًا، وصحيت امتى. مش مفكرة." },
  ],
  patientSessions: [
    { therapist: "د. نادية فاروق", when: "بكرة، ٦ مساءً", brief: null },
    {
      therapist: "د. نادية فاروق",
      when: "الثلاثاء اللي فات",
      brief: "قلت إنك هتجرب تنام بدري، وفي الليلتين اللي عملت فيهم كده فعلًا نفع.",
    },
  ],
  summaryVersions: [
    {
      version: 2,
      author: "د. يوسف بكر",
      on: "٤ يونيو",
      body: "مكمل بعد د. نادية. النوم بقى أهدى، واللي تحته قلق الشغل وده اللي شغالين عليه دلوقتي. قلت إن التقييم هو اللي بيقلقك مش الشغل نفسه، وده كلام يستاهل نمسك فيه.",
    },
    {
      version: 1,
      author: "د. نادية فاروق",
      on: "١٨ مارس",
      body: "جيت بسبب النوم، ولقينا النمط اللي حوالين التقييم في جلستين. روتين ما قبل النوم بينفع في الليالي اللي بتلتزم بيه. بسلّم الملف لأنك بتنتقل مدينة، مش لأن حاجة مشيت غلط.",
    },
  ],
  journalEntries: [
    { on: "٢ يونيو", text: "نمت الليلة كلها لأول مرة من حوالي تلات أسابيع. مفيش حاجة مخصوص حصلت، وده الجزء المضايق." },
    { on: "٢٩ مايو", text: "ليلة وحشة. فضلت أعيد التقييم في دماغي لحد تقريبًا اتنين. عملت التنفس، نفع شوية، مش كتير." },
  ],
};

/**
 * The demo copy for this reader's language, or the shipped default.
 *
 * Read through the same fallback chain as a page: exact locale, then English,
 * then the constant above. A missing Arabic row is an English demo, never an
 * empty panel.
 */
export async function getDemoContent(requested?: string): Promise<DemoContent> {
  /*
   * 🔴 Resolved before the try, so a caller that KNOWS the language is never
   * at the mercy of the runtime.
   *
   * `getLocale()` reads a cookie and throws **synchronously** outside a
   * request, which `.catch()` does not catch (19.0a learned this once
   * already), so every script-rendered page landed in the outer catch and got
   * the English constant. A caller that passes a locale now keeps it even when
   * the whole read fails.
   */
  const locale = requested ?? (await getLocale().catch(() => "en" as const));
  const floor = locale === "ar" ? DEMO_FALLBACK_AR : DEMO_FALLBACK;

  try {

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

    const fallback = floor;

    const row = rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === "en");
    if (!row) return fallback;

    return fromBlocks(row.blocks, fallback) ?? fallback;
  } catch {
    // The public site never fails because of the CMS. Same rule as defaults.ts.
    return floor;
  }
}

/**
 * A `demo` page's blocks, read as demo copy.
 *
 * Deliberately forgiving: a missing section falls back field by field rather
 * than dropping the whole row, because an admin editing one paragraph of the
 * transcript should not be able to blank the homepage.
 */
function fromBlocks(blocks: unknown, floor: DemoContent = DEMO_FALLBACK): DemoContent | null {
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
  const summary = find("summary");
  const journal = find("journal");

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
      })) ?? floor.transcript,
    brief: brief?.body ?? floor.brief,
    steps: homework?.items?.map((item) => item.title ?? "") ?? floor.steps,
    observations:
      observations?.items?.map((item) => ({ at: item.title ?? "", text: item.body ?? "" })) ??
      floor.observations,
    homework:
      homework?.items?.map((item) => ({ title: item.title ?? "", detail: item.body ?? "" })) ??
      floor.homework,
    patientSessions: floor.patientSessions,
    /*
     * 28.6 — editable like every other demo, and field-by-field like every
     * other demo: an admin rewriting one version must not blank the panel.
     *
     * The version number is positional rather than typed by the editor, so a
     * demo of an append-only record cannot be made to show version 5 above
     * version 9, which would demonstrate the opposite of 26.1.
     */
    summaryVersions:
      summary?.items?.map((item, i) => ({
        version: (summary.items?.length ?? 0) - i,
        author: item.title ?? "",
        on: "",
        body: item.body ?? "",
      })) ?? floor.summaryVersions,
    journalEntries:
      journal?.items?.map((item) => ({ on: item.title ?? "", text: item.body ?? "" })) ??
      floor.journalEntries,
  };
}
