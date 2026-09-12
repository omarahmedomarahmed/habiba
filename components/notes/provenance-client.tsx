"use client";

import { Badge } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import type { NoteProvenance } from "@/lib/db/schema";

/**
 * 47.3 / 47.4 — the patient's own view of how their note was made.
 *
 * ## Why there are two files and not one
 *
 * `provenance.tsx` is a server component: it calls `getI18n()`, which is the
 * right resolver on every screen rendered on the server and is unusable inside
 * a client component. C199 and C205 are both that mistake, twice, and the
 * guard written after them catches it at build time now.
 *
 * The patient's session list is a client component — it holds the timezone the
 * browser resolved and the tab state — so it needs a client twin. What is
 * shared is the thing that matters: **the same dictionary keys**. Two
 * components rendering `note.origin.patient*` cannot drift into describing the
 * same note differently, which is the failure 47.3's "one component" is really
 * about. Two renderers of one vocabulary is not the defect; two vocabularies
 * would be.
 */
export function PatientNoteOriginClient({ provenance }: { provenance: NoteProvenance }) {
  const t = useT();

  if (provenance === "transcript") {
    return <Badge tone="teal">{t("note.origin.patientTranscript")}</Badge>;
  }
  if (provenance === "partial") {
    return <Badge tone="amber">{t("note.origin.patientPartial")}</Badge>;
  }
  return <Badge tone="slate">{t("note.origin.patientClinician")}</Badge>;
}
