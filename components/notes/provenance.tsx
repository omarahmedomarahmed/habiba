import { FileText, Mic, MicOff } from "lucide-react";

import { Badge } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import type { NoteProvenance } from "@/lib/db/schema";

/**
 * How a note was made, said once. PLAN.md 47.1, 47.3, C212, C213.
 *
 * ## Why this is one component and not a field on five screens
 *
 * A future therapist reads eight notes and, without this, has no way to tell
 * that three of them rest on a colleague's recollection of a session nobody
 * recorded. That is the difference between evidence and hearsay, presented
 * identically, in a record somebody may act on.
 *
 * 47.3 names the surfaces: the clinician's own view, the next clinician's
 * view, the patient's record, the export, and the evidence screen. Five
 * screens with their own copy of this logic is five chances for two of them to
 * disagree about the same note, which is the shape `SessionBadge` was built to
 * stop in 37L.2.
 *
 * ## 🔴 The wording is SOURCE, never quality
 *
 * 47.5 is explicit that a hand-written note is not weaker evidence, it is
 * differently sourced, and the evidence screen keeps `clinician` at source
 * priority 1. So none of the three strings carries a word like "unverified",
 * and the clinician one says what every written record in the world was before
 * recordings existed. A badge that reads as an accusation is a badge
 * clinicians will work around.
 *
 * ## Why `partial` insists on a duration
 *
 * C213: "partially recorded" without a number is a badge nobody can act on. A
 * session missing ninety seconds and a session missing half an hour are not
 * the same document, and a reader who cannot tell them apart will treat both
 * as the worse one.
 *
 * A server component asking for its own language, so no call site can forget
 * to pass one (C206).
 */
export async function NoteOrigin({
  provenance,
  offRecordSeconds,
}: {
  provenance: NoteProvenance;
  offRecordSeconds?: number | null;
}) {
  const { t } = await getI18n();

  if (provenance === "transcript") {
    return (
      <Badge tone="teal">
        <Mic className="h-3 w-3" aria-hidden /> {t("note.origin.transcript")}
      </Badge>
    );
  }

  if (provenance === "partial") {
    return (
      <Badge tone="amber">
        <MicOff className="h-3 w-3" aria-hidden /> {t("note.origin.partial")}
      </Badge>
    );
  }

  return (
    <Badge tone="slate">
      <FileText className="h-3 w-3" aria-hidden /> {t("note.origin.clinician")}
    </Badge>
  );
}

/**
 * The same fact, at length, for a screen with room to explain it.
 *
 * The badge is for a list. This is for the top of a document somebody is about
 * to rely on, where "why does this say that" is a question worth answering in
 * place rather than in a help page.
 */
export async function NoteOriginNote({
  provenance,
  offRecordSeconds,
}: {
  provenance: NoteProvenance;
  offRecordSeconds?: number | null;
}) {
  const { t } = await getI18n();

  const body =
    provenance === "transcript"
      ? t("note.origin.transcriptWhy")
      : provenance === "partial"
        ? t("note.origin.partialWhy", {
            /*
             * Rounded UP, and never to zero. Forty seconds off record is not
             * "0 minutes missing", which reads as nothing missing at all; it
             * is the smallest true statement that is still a warning.
             */
            minutes: Math.max(1, Math.ceil((offRecordSeconds ?? 0) / 60)),
          })
        : t("note.origin.clinicianWhy");

  return (
    <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5">
      <div className="mt-0.5 shrink-0">
        <NoteOrigin provenance={provenance} offRecordSeconds={offRecordSeconds} />
      </div>
      <p className="text-xs leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}

/**
 * 47.4 — the same session, told to the person whose session it was.
 *
 * Deliberately different words rather than the clinician's reused. A clinician
 * reads "from the recording" as a fact about a document they are relying on; a
 * patient reads their own decision back to them, because it was their choice
 * that produced it and the record is theirs.
 */
export async function PatientNoteOrigin({ provenance }: { provenance: NoteProvenance }) {
  const { t } = await getI18n();

  if (provenance === "transcript") {
    return <Badge tone="teal">{t("note.origin.patientTranscript")}</Badge>;
  }
  if (provenance === "partial") {
    return <Badge tone="amber">{t("note.origin.patientPartial")}</Badge>;
  }
  return <Badge tone="slate">{t("note.origin.patientClinician")}</Badge>;
}
