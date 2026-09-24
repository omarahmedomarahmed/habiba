/**
 * 🔴 What the patient's session email may carry. Read by `releaseBrief`.
 *
 * Only `patientBrief`, the field written TO the patient and approved by the
 * clinician as their copy. Never `summary`: that is the clinician's field,
 * written for the record, and an empty patient copy means there is nothing
 * approved to send, not that the record should go instead.
 */
export function patientCopyText(
  content: { patientBrief?: string | null; summary?: string | null } | null | undefined,
): string | null {
  return content?.patientBrief?.trim() || null;
}
