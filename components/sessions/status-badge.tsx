import { Badge } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";

/**
 * What a session is, in one word, in the reader's language. 37L.2.
 *
 * There were three of these, one per screen, each with its own English inside
 * a module-level helper with no translator in scope. That is the shape the
 * project keeps meeting: copy in a function nothing could reach. Three copies
 * of a word is also three chances for two of them to disagree, which is how
 * "Not started" and "Scheduled" end up on the same list.
 *
 * It is a server component and asks for its own language, so a call site
 * cannot forget to pass one.
 */
export async function SessionBadge({
  status,
  noteStatus,
}: {
  status: string;
  /** When given, a finished session shows what its note is doing instead. */
  noteStatus?: string;
}) {
  const { t } = await getI18n();

  if (status === "in_progress") return <Badge tone="red">{t("portal.status.live")}</Badge>;
  if (status === "scheduled") return <Badge tone="amber">{t("portal.status.notStarted")}</Badge>;
  if (status === "cancelled") return <Badge tone="slate">{t("portal.status.cancelled")}</Badge>;

  if (noteStatus === undefined) {
    return <Badge tone="green">{t("portal.status.completed")}</Badge>;
  }
  if (noteStatus === "generating") return <Badge tone="brand">{t("portal.status.writing")}</Badge>;
  if (noteStatus === "failed") return <Badge tone="amber">{t("portal.status.noteFailed")}</Badge>;
  return <Badge tone="green">{t("portal.status.noteReady")}</Badge>;
}

/** Where a note has got to: still the clinician's, signed, or with the patient. */
export async function NoteBadge({
  status,
  patientStatus,
}: {
  status: string;
  patientStatus: string | null;
}) {
  const { t } = await getI18n();

  if (status === "draft") return <Badge tone="amber">{t("portal.status.draft")}</Badge>;
  // Signed, but the patient still has nothing.
  if (patientStatus === "draft") return <Badge tone="teal">{t("portal.status.summaryHeld")}</Badge>;
  return <Badge tone="green">{t("portal.status.approved")}</Badge>;
}
