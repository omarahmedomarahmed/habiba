"use client";

import Link from "next/link";

import { DocumentList, type DocumentRow } from "@/components/documents/document-list";
import { useReaderZone } from "@/lib/scheduling/use-reader-zone";
import { flagOwnContent } from "@/app/(patient)/patient/profile/actions";
import { useT } from "@/lib/i18n/client";

/**
 * The person's own documents, with the same list the clinician sees.
 *
 * Deliberately the same component. Two renderers for one thing is two places
 * for "image, not searchable" to be missing from, and the label is the whole
 * point of 8.4.
 *
 * ## 🔴 26.5 — the upload control is gone, and that is the feature
 *
 * `AddDocument` used to sit at the top of this panel, offering a patient a file
 * picker and a "dictate your history" box. Both were the product asking a
 * person to do a clinician's job: photographing a prescription is filing, and
 * dictating your own clinical history means writing a document about yourself
 * in a register nobody has at eleven at night. What people actually do at
 * eleven at night is say how the week went, so that is what they are offered
 * now, and it lives at `/patient/journal`.
 *
 * The LIST stays. Everything a clinician added about them is still theirs to
 * read and still theirs to flag; what changed is that they are no longer the
 * filing clerk.
 */
export function OwnProfilePanel({
  documents,
  watermark,
}: {
  documents: DocumentRow[];
  watermark: string;
}) {
  const t = useT();
  /*
   * 12.3 — the patient portal has no stored zone yet (§3b's signup, sprint 13),
   * so both render passes start at UTC and the reader's own zone arrives after
   * mount. Agreeing beats being right on only one of the two passes.
   */
  const zone = useReaderZone();

  return (
    <div className="space-y-3">
      <Link
        href="/patient/journal"
        className="block rounded-2xl border border-slate-200 bg-white p-4"
      >
        <span className="block text-sm font-semibold text-slate-900">
          {t("pprofile.sayInstead")}
        </span>
        <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">
          {t("pprofile.sayInsteadBody")}
        </span>
      </Link>

      <DocumentList
        zone={zone}
        documents={documents}
        watermark={watermark}
        onFlag={async (documentId, reason) => {
          await flagOwnContent({ targetType: "document", targetId: documentId, reason });
        }}
      />
    </div>
  );
}
