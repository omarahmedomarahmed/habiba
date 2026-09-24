import type { NoteContent, NoteSection } from "@/lib/db/schema";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * 🔴 W2-F01 / D7: a note format is DATA, so a new one needs no code.
 *
 * The founder's decision: notes in any format, all included in the session
 * price, all saved on the patient's history. A format is a key, a label and an
 * ordered list of sections, each with a short guide the draft follows. SOAP is
 * one of them and nothing more: every SOAP note written before this still reads
 * from `content.soap`, untouched, and every other format writes `content.sections`.
 *
 * Pure and client safe: the note card, the editor, the prompt, the export and
 * the record-system filing all read the same table.
 *
 * `label` is the English heading, which is what a chart, an export and a model
 * read. `labelKey` is the heading on a screen, in the reader's language. A
 * clinician's own template has only `label`, in whatever words they wrote.
 */
export type NoteSectionDef = {
  key: string;
  label: string;
  guide: string;
  labelKey?: MessageKey;
};

export type NoteFormat = {
  key: string;
  label: string;
  labelKey?: MessageKey;
  sections: NoteSectionDef[];
  builtIn: boolean;
};

const S = (key: string, label: string, labelKey: MessageKey, guide: string): NoteSectionDef => ({
  key,
  label,
  labelKey,
  guide,
});

const plan = S("plan", "Plan", "tnote.plan", "What happens next: interventions, homework, referrals and the next session.");
const assessment = S(
  "assessment",
  "Assessment",
  "tnote.assessment",
  "The clinician's provisional understanding: progress, formulation and any risk.",
);
const intervention = S(
  "intervention",
  "Intervention",
  "tnf.intervention",
  "What the clinician did in the session: techniques, methods and topics addressed.",
);
const response = S(
  "response",
  "Response",
  "tnf.response",
  "How the patient responded to what was done, in the session.",
);

const SOAP_KEY = "soap";

/** Ordered as a clinician meets them: the one everybody knows first. */
export const BUILT_IN_FORMATS: readonly NoteFormat[] = [
  {
    key: SOAP_KEY,
    label: "SOAP",
    builtIn: true,
    sections: [
      S("subjective", "Subjective", "tnote.subjective", "What the patient reported: concerns, symptoms and their own account."),
      S("objective", "Objective", "tnote.objective", "What the clinician observed: presentation, affect and behaviour in the session."),
      assessment,
      plan,
    ],
  },
  {
    key: "dap",
    label: "DAP",
    builtIn: true,
    sections: [
      S("data", "Data", "tnf.data", "What was said and observed in the session, reported and observed together."),
      assessment,
      plan,
    ],
  },
  {
    key: "birp",
    label: "BIRP",
    builtIn: true,
    sections: [
      S("behavior", "Behaviour", "tnf.behavior", "The patient's presentation and what they reported today."),
      intervention,
      response,
      plan,
    ],
  },
  {
    key: "girp",
    label: "GIRP",
    builtIn: true,
    sections: [
      S("goal", "Goal", "tnf.goal", "The treatment goal or goals this session worked on."),
      intervention,
      response,
      plan,
    ],
  },
  {
    key: "pie",
    label: "PIE",
    builtIn: true,
    sections: [
      S("problem", "Problem", "tnf.problem", "The problem or need this session addressed."),
      intervention,
      S("evaluation", "Evaluation", "tnf.evaluation", "How the patient responded, and progress toward resolving the problem."),
    ],
  },
  {
    key: "sirp",
    label: "SIRP",
    builtIn: true,
    sections: [
      S("situation", "Situation", "tnf.situation", "The patient's current situation and what they brought today."),
      intervention,
      response,
      plan,
    ],
  },
  {
    key: "narrative",
    label: "Narrative",
    labelKey: "tnf.narrative",
    builtIn: true,
    sections: [
      S("note", "Narrative", "tnf.narrative", "An account of the session in continuous prose: what was brought, what was done, how it went and what comes next."),
    ],
  },
];

export const SOAP: NoteFormat = BUILT_IN_FORMATS[0]!;

/** A clinician's own template, as `note_templates` stores it. */
export type TemplateRow = {
  id: string;
  label: string;
  sections: { key: string; label: string; guide: string }[];
};

export const TEMPLATE_PREFIX = "tpl:";

export function templateFormat(row: TemplateRow): NoteFormat {
  return {
    key: `${TEMPLATE_PREFIX}${row.id}`,
    label: row.label,
    builtIn: false,
    sections: row.sections.map((section) => ({
      key: section.key,
      label: section.label,
      guide: section.guide,
    })),
  };
}

export function builtInFormat(key: string | null | undefined): NoteFormat | null {
  return BUILT_IN_FORMATS.find((format) => format.key === key) ?? null;
}

/**
 * Resolve a format key against the built-ins and the templates the caller
 * already holds. An unknown key is SOAP, which is what every note was before.
 */
export function resolveFormat(key: string | null | undefined, templates: TemplateRow[] = []): NoteFormat {
  const builtIn = builtInFormat(key);
  if (builtIn) return builtIn;
  if (key?.startsWith(TEMPLATE_PREFIX)) {
    const row = templates.find((template) => `${TEMPLATE_PREFIX}${template.id}` === key);
    if (row) return templateFormat(row);
  }
  return SOAP;
}

export function isSoap(format: NoteFormat | string): boolean {
  return (typeof format === "string" ? format : format.key) === SOAP_KEY;
}

/**
 * Template sections from what a clinician typed: one per line, heading then a
 * colon then the guide. Keys are positional (`s1`, `s2`), never derived from
 * the heading, so renaming a heading cannot orphan the text under it.
 */
const MAX_TEMPLATE_SECTIONS = 8;

export function parseTemplateSections(text: string): { key: string; label: string; guide: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_TEMPLATE_SECTIONS)
    .map((line, index) => {
      const at = line.indexOf(":");
      const label = (at >= 0 ? line.slice(0, at) : line).trim().slice(0, 60);
      const guide = (at >= 0 ? line.slice(at + 1) : "").trim().slice(0, 240);
      return { key: `s${index + 1}`, label, guide };
    })
    .filter((section) => section.label.length > 0);
}

/* -------------------------------------------------- reading a stored note -- */

/**
 * The sections of any stored note, in order, with the English heading.
 *
 * A note with `sections` is written in that format. A note without is SOAP,
 * which is every note written before formats existed: its four fields are read
 * where they have always been, so nothing about an existing note changes.
 */
export function noteSections(content: NoteContent): NoteSection[] {
  if (Array.isArray(content.sections) && content.sections.length > 0) {
    return content.sections.map((section) => ({
      key: String(section.key ?? ""),
      label: String(section.label ?? ""),
      text: typeof section.text === "string" ? section.text : "",
    }));
  }
  const soap = content.soap ?? { subjective: "", objective: "", assessment: "", plan: "" };
  return SOAP.sections.map((section) => ({
    key: section.key,
    label: section.label,
    text: (soap as Record<string, string>)[section.key] ?? "",
  }));
}

/** The heading on a screen: the built-in's translation, or the stored words. */
export function sectionLabelKey(formatKey: string, sectionKey: string): MessageKey | null {
  return builtInFormat(formatKey)?.sections.find((s) => s.key === sectionKey)?.labelKey ?? null;
}

/**
 * Headings and text, for a chart that is not ours: the record-system filing,
 * the partner draft. Empty sections are left out, as the partner draft always did.
 */
export function sectionsText(content: NoteContent): string {
  return noteSections(content)
    .filter((section) => section.text.trim().length > 0)
    .map((section) => `${section.label}\n${section.text.trim()}`)
    .join("\n\n");
}

/** An empty note in a format: "Write it yourself" opens these sections. */
export function emptyContent(format: NoteFormat): NoteContent {
  return {
    soap: { subjective: "", objective: "", assessment: "", plan: "" },
    ...(isSoap(format)
      ? {}
      : { sections: format.sections.map((s) => ({ key: s.key, label: s.label, text: "" })) }),
    summary: "",
    talkingPoints: [],
    observations: "",
    impressions: "",
    recommendations: [],
    followUp: "",
    patientBrief: "",
    patientSteps: [],
    patientNext: "",
  };
}

/**
 * The stored sections with only the TEXT taken from an edit. The keys and
 * headings are the note's own, so an editor cannot turn a DAP note into
 * something else by posting different headings.
 */
export function mergeSectionText(stored: NoteSection[], sent: unknown): NoteSection[] {
  const incoming = Array.isArray(sent) ? (sent as Partial<NoteSection>[]) : [];
  return stored.map((section) => {
    const match = incoming.find((s) => s?.key === section.key);
    return { ...section, text: typeof match?.text === "string" ? match.text : section.text };
  });
}

/* ------------------------------------------------- W2-T03 / W2-T04 · state -- */

/**
 * 🔴 W2-T03: what the note area of a session shows.
 *
 * "Writing your note" used to be the answer to anything that was not a note
 * and not `failed`, so a cancelled session (`none`, and nothing will ever
 * write) and a job that died mid-flight (`generating` for ever) both spun for
 * ever. Writing is now only a job that is running and young enough to finish:
 * the platform stops a function well inside fifteen minutes (H9).
 */
const NOTE_JOB_STALE_MS = 15 * 60_000;

export type NoteView = "writing" | "note" | "failed" | "none";

export function noteView(input: {
  sessionStatus: string;
  noteStatus: "none" | "generating" | "ready" | "failed";
  hasNote: boolean;
  /** When the session row last changed: the job's start, at the latest. */
  updatedAt: Date;
  now: Date;
}): NoteView {
  const running =
    input.noteStatus === "generating" &&
    input.now.getTime() - input.updatedAt.getTime() < NOTE_JOB_STALE_MS;
  if (running) return "writing";
  if (input.hasNote) return "note";
  if (input.sessionStatus === "cancelled") return "none";
  return "failed";
}

/**
 * 🔴 W2-T04: a draft can be written again from the transcript, whenever there
 * is one. It used to be offered only after a failure, so a clinician who put a
 * voice or a line right had no way to have the note follow.
 */
export function canRedraft(input: {
  status: "draft" | "approved";
  recordingConsent: string | null | undefined;
  hasTranscript: boolean;
}): boolean {
  return input.status === "draft" && input.recordingConsent === "granted" && input.hasTranscript;
}
