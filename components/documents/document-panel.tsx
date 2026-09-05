"use client";

import { AddDocument } from "@/components/documents/add-document";
import { DocumentList, type DocumentRow } from "@/components/documents/document-list";
import {
  addNote,
  flagContent,
  uploadDocumentFile,
} from "@/app/(app)/patients/[id]/documents/actions";

/**
 * The clinician's half of the profile: the list, plus the three ways to add.
 *
 * A thin client wrapper whose only job is to bind the server actions to the
 * pure list and form. The actions take the patient id as their first argument
 * rather than reading it from a form field, so a rewritten hidden input cannot
 * point a write at somebody else's chart — the id in the closure is the one
 * the page was rendered for, and every action re-checks it server-side anyway.
 */
export function DocumentPanel({
  patientId,
  documents,
  watermark,
  canAdd,
}: {
  patientId: string;
  documents: DocumentRow[];
  watermark: string;
  canAdd: boolean;
}) {
  return (
    <div className="space-y-3">
      {canAdd ? (
        <AddDocument
          onUpload={(formData) => uploadDocumentFile(patientId, formData)}
          onNote={(input) => addNote(patientId, input)}
        />
      ) : null}

      <DocumentList
        documents={documents}
        watermark={watermark}
        onFlag={async (documentId, reason) => {
          await flagContent(patientId, { targetType: "document", targetId: documentId, reason });
        }}
      />
    </div>
  );
}
