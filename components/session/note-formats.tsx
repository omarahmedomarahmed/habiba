"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { alsoWriteNote } from "@/app/(app)/sessions/actions";
import { Button } from "@/components/ui";
import type { MessageKey } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type FormatChoice = { key: string; label: string; labelKey?: MessageKey | null };

/**
 * 🔴 W2-F01 / D7: the session's notes, one per format, and "Also write it as".
 *
 * Each format is its own document, so each is its own tab with its own state.
 * Adding one drafts the same session in that format and opens it; it adds
 * nothing to any invoice (the session price includes every format).
 */
export function NoteFormats({
  sessionId,
  notes,
  selectedId,
  options,
}: {
  sessionId: string;
  notes: (FormatChoice & { id: string; signed: boolean })[];
  selectedId: string | null;
  /** Formats this session has no note in yet. */
  options: FormatChoice[];
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState(options[0]?.key ?? "");
  const [error, setError] = useState<string | null>(null);
  const name = (f: FormatChoice) => (f.labelKey ? t(f.labelKey) : f.label);

  return (
    <div className="space-y-2">
      {notes.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {notes.map((note) => (
            <Link
              key={note.id}
              href={`/sessions/${sessionId}?note=${note.id}`}
              aria-current={note.id === selectedId ? "page" : undefined}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-sm font-semibold",
                note.id === selectedId
                  ? "border-navy-500 bg-white text-slate-900"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50",
              )}
            >
              {name(note)}
              <span
                className={cn(
                  "ms-1.5 text-xs font-medium",
                  note.signed ? "text-emerald-600" : "text-amber-600",
                )}
              >
                {note.signed ? t("tnote.stateSigned") : t("tnote.stateDraft")}
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      {options.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="also-write" className="text-sm text-slate-600">
            {t("tnf.alsoWrite")}
          </label>
          <select
            id="also-write"
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-sm"
          >
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {name(option)}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            disabled={pending || !choice}
            onClick={() =>
              start(async () => {
                setError(null);
                const result = await alsoWriteNote(sessionId, choice);
                if (result.error) setError(result.error);
                else if (result.noteId) router.push(`/sessions/${sessionId}?note=${result.noteId}`);
              })
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("tnf.write")}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
