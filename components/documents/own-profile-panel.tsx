"use client";

import { AddDocument } from "@/components/documents/add-document";
import { DocumentList, type DocumentRow } from "@/components/documents/document-list";
import { addOwnFile, addOwnNote, flagOwnContent } from "@/app/(patient)/patient/profile/actions";

/**
 * The person's own documents, with the same list the clinician sees.
 *
 * Deliberately the same component. Two renderers for one thing is two places
 * for "image — not searchable" to be missing from, and the label is the whole
 * point of 8.4.
 */
export function OwnProfilePanel({
  documents,
  watermark,
}: {
  documents: DocumentRow[];
  watermark: string;
}) {
  return (
    <div className="space-y-3">
      <AddDocument onUpload={addOwnFile} onNote={addOwnNote} />

      <DocumentList
        documents={documents}
        watermark={watermark}
        onFlag={async (documentId, reason) => {
          await flagOwnContent({ targetType: "document", targetId: documentId, reason });
        }}
      />
    </div>
  );
}
