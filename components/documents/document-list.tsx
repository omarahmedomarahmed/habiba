"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, FileText, Flag, ImageIcon, Mic, Volume2 } from "lucide-react";

import { Badge, Card } from "@/components/ui";
import { isImage, searchabilityLabel } from "@/lib/documents/formats";
import { formatDate } from "@/lib/utils";

/**
 * A person's documents, as a clinician or the person themselves sees them.
 * PLAN.md 8.4 / 8.7 / 8.8 / 8.10.
 *
 * ## The label is the feature
 *
 * §3 / 8.4: an image we cannot read is still stored, shown and zoomable, and
 * labelled *"image — not searchable"*. That label is not a caveat, it is the
 * point. A clinician who believes the copilot has read a discharge summary
 * will not go and read it themselves — so every document says plainly whether
 * the copilot can see inside it.
 *
 * ## The viewer is read-only, and honestly so
 *
 * 8.10 asks for a read-only viewer, a watermark, and an audit trail. What that
 * means here: the bytes come from `/api/documents/<id>`, which checks consent
 * and writes an audit row on every read (H14 — the blob URL never reaches the
 * browser); the watermark is drawn over the image; and "read aloud" posts a
 * document id, so the text is spoken without ever being in the page.
 *
 * What none of that stops is a photograph of the screen. Nothing does, and the
 * copy does not pretend otherwise.
 */

export type DocumentRow = {
  id: string;
  ordinal: number;
  title: string;
  source: "upload" | "typed" | "dictated";
  mimeType: string | null;
  byteSize: number | null;
  extraction: "none" | "pending" | "ready" | "unsupported" | "failed";
  documentDate: string | null;
  createdAt: string;
  /** 8.7 — resolved on the server; a name, or "you", or the person themselves. */
  addedBy: string;
  flags: { id: string; reason: string; note: string | null }[];
};

export function DocumentList({
  documents,
  watermark,
  onFlag,
}: {
  documents: DocumentRow[];
  /** The line drawn across every image. Who is looking, and when. */
  watermark: string;
  onFlag?: (documentId: string, reason: "outdated" | "wrong" | "not_mine") => Promise<void>;
}) {
  if (documents.length === 0) {
    return (
      <Card className="px-4 py-6">
        <p className="text-sm text-slate-500">
          Nothing here yet. Letters, prescriptions, scans and old reports all belong here — a
          photograph of a page is fine.
        </p>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {documents.map((document) => (
        <DocumentCard key={document.id} document={document} watermark={watermark} onFlag={onFlag} />
      ))}
    </ul>
  );
}

function DocumentCard({
  document,
  watermark,
  onFlag,
}: {
  document: DocumentRow;
  watermark: string;
  onFlag?: (documentId: string, reason: "outdated" | "wrong" | "not_mine") => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [pending, startTransition] = useTransition();

  const { label, searchable } = searchabilityLabel({
    extraction: document.extraction,
    mimeType: document.mimeType,
  });
  const image = isImage(document.mimeType);
  const flagged = document.flags.length > 0;

  const speak = async () => {
    setSpeaking(true);
    try {
      // A document id, never text. 8.10 — the words are spoken without ever
      // being in this page.
      const response = await fetch(`/api/documents/${document.id}/speak`, { method: "POST" });
      if (!response.ok) return;
      const audio = new Audio(URL.createObjectURL(await response.blob()));
      audio.onended = () => setSpeaking(false);
      await audio.play();
    } catch {
      setSpeaking(false);
    }
  };

  return (
    <li>
      <Card className={flagged ? "border-amber-200" : undefined}>
        <div className="flex items-start gap-3 px-4 py-3">
          <span className="mt-0.5 text-slate-400">
            {document.source === "dictated" ? (
              <Mic className="h-4 w-4" aria-hidden />
            ) : image ? (
              <ImageIcon className="h-4 w-4" aria-hidden />
            ) : (
              <FileText className="h-4 w-4" aria-hidden />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">
              <span className="me-1.5 font-mono text-xs text-slate-400">D{document.ordinal}</span>
              {document.title}
            </p>
            {/* 8.7 — provenance, on the face of the row rather than behind it. */}
            <p className="mt-0.5 text-xs text-slate-500">
              {formatDate(new Date(document.documentDate ?? document.createdAt))} ·{" "}
              {document.addedBy}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={searchable ? "slate" : "amber"}>{label}</Badge>
              {document.flags.map((flag) => (
                <Badge key={flag.id} tone="amber">
                  Flagged: {flag.reason.replace("_", " ")}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-2.5">
          {document.source === "upload" ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="tap-target h-9 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              {open ? "Close" : "Open"}
            </button>
          ) : null}

          {searchable ? (
            <button
              type="button"
              disabled={speaking}
              onClick={speak}
              className="tap-target flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              <Volume2 className="h-3.5 w-3.5" aria-hidden />
              {speaking ? "Reading…" : "Read aloud"}
            </button>
          ) : null}

          {onFlag ? (
            <button
              type="button"
              onClick={() => setFlagging((v) => !v)}
              className="tap-target ms-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              <Flag className="h-3.5 w-3.5" aria-hidden />
              Flag
            </button>
          ) : null}
        </div>

        {flagging && onFlag ? (
          <div className="border-t border-slate-100 px-4 py-3">
            {/*
              8.8 — a flag never deletes and never edits. The copy says so,
              because "flag as wrong" reads like "remove" to somebody who has
              just found something upsetting in their own record.
            */}
            <p className="text-xs leading-relaxed text-slate-500">
              This marks the document. It does not change or remove it — a clinical record has to
              stay as it was written.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["outdated", "wrong", "not_mine"] as const).map((reason) => (
                <button
                  key={reason}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await onFlag(document.id, reason);
                      setFlagging(false);
                    })
                  }
                  className="tap-target h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {reason === "not_mine" ? "Not about me" : `This is ${reason}`}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {open ? (
          <div className="border-t border-slate-100 p-3">
            {image ? (
              /*
               * 8.10's watermark. Drawn over the image in the page rather than
               * burned into the bytes, which would mean re-encoding every
               * document on every read and would still not survive a
               * screenshot. What it does do is put the reader's name on any
               * screenshot they take, which is what a watermark is actually
               * for.
               */
              <div className="relative overflow-auto rounded-xl bg-slate-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/documents/${document.id}`}
                  alt={document.title}
                  className="mx-auto max-h-[70vh] w-auto select-none"
                  draggable={false}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <span className="rotate-[-24deg] text-center text-sm font-semibold tracking-wide text-white/25">
                    {watermark}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
                    aria-hidden
                  />
                  This file opens in a new tab. Everything you open is recorded against your name.
                </p>
                <a
                  href={`/api/documents/${document.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-xs font-semibold text-brand-600 hover:underline"
                >
                  Open {document.title}
                </a>
              </div>
            )}
          </div>
        ) : null}
      </Card>
    </li>
  );
}
