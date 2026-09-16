"use client";

import { addNote, uploadDocumentFile } from "@/app/(app)/patients/[id]/documents/actions";
import { AddDocument } from "@/components/documents/add-document";

/**
 * 🔴 76.40 — ADDING TO SOMEBODY'S HISTORY FROM THEIR PROFILE.
 *
 * The same three ways in that the documents screen offers — upload, type,
 * dictate — and the same two server actions, so there is one path into the
 * record and not a second one that behaves slightly differently.
 *
 * It exists as its own file for one reason: `DocumentPanel` pairs the control
 * with the full document list, its watermark and its flagging, which is the
 * right screen for reading a history and the wrong one for a profile. This is
 * the control without the reading room.
 *
 * 🔴 IT DOES NOT DECIDE WHO MAY WRITE. `writable()` inside both actions asks
 * that question against the grant, and the profile page hides this whole panel
 * in the revoked state. If those two ever disagree the server wins, which is
 * the only arrangement where a hidden control is a convenience rather than the
 * access control itself.
 */
export function AddToHistory({ patientId }: { patientId: string }) {
  return (
    <AddDocument
      onUpload={(formData) => uploadDocumentFile(patientId, formData)}
      onNote={(input) => addNote(patientId, input)}
    />
  );
}
