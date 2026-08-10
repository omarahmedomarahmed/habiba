"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Mail, Pencil, RefreshCw, Sparkles } from "lucide-react";

import { NoteCard } from "@/components/clinical/note-card";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import {
  approveNote,
  regenerateNote,
  saveNote,
} from "@/app/(app)/sessions/actions";
import { RTL_LANGUAGES, type NoteContent } from "@/lib/db/schema";

type Props = {
  sessionId: string;
  initialNote: NoteContent | null;
  /** ISO 639-1 of the language the session was held in. */
  language: string;
  languageLabel: string;
  /** English rendering, when the session was not in English. */
  contentEn: NoteContent | null;
  initialStatus: "draft" | "approved";
  noteStatus: "none" | "generating" | "ready" | "failed";
  patientLabel: string;
  patientEmail: string | null;
  dateLabel: string;
  reportSent: boolean;
};

export function NoteReview(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [note, setNote] = useState<NoteContent | null>(props.initialNote);
  const [status, setStatus] = useState(props.initialStatus);
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState(props.patientEmail ?? "");
  const [showShare, setShowShare] = useState(false);
  const [sent, setSent] = useState(props.reportSent);
  /**
   * Which copy is on screen. The clinical record is the one in the session's
   * own language — that is what gets edited, approved and signed. English is a
   * read-only convenience, so switching to it turns editing off rather than
   * letting someone sign a translation.
   */
  const [showEnglish, setShowEnglish] = useState(false);

  const rtl = RTL_LANGUAGES.has(props.language);
  const translated = props.contentEn;
  const viewing: NoteContent | null = showEnglish && translated ? translated : note;

  /**
   * While the note is being written, poll for it.
   *
   * Generation runs in `after()` on the server — it survives the response but
   * has no channel back to this page, so the page asks. Three seconds is well
   * inside the ~18 second typical generation time and stops as soon as the note
   * lands, so the total is a handful of requests.
   */
  useEffect(() => {
    if (props.noteStatus !== "generating") return;
    const poll = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(poll);
  }, [props.noteStatus, router]);

  useEffect(() => {
    setNote(props.initialNote);
    setStatus(props.initialStatus);
  }, [props.initialNote, props.initialStatus]);

  if (props.noteStatus === "generating" || (!note && props.noteStatus !== "failed")) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <Sparkles className="h-6 w-6 animate-pulse text-brand-500" aria-hidden />
        <p className="text-base font-semibold text-slate-900">Writing your note</p>
        <p className="max-w-xs text-sm text-slate-500">
          This usually takes under half a minute. You can leave this page — it will be here when
          you get back.
        </p>
      </Card>
    );
  }

  if (props.noteStatus === "failed" || !note) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <p className="text-base font-semibold text-slate-900">The note could not be written</p>
        <p className="max-w-sm text-sm text-slate-500">
          This usually means very little was captured — check the transcript below. You can try
          again without re-running the session.
        </p>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await regenerateNote(props.sessionId);
              router.refresh();
            })
          }
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> Try again
        </Button>
      </Card>
    );
  }

  const update = (patch: Partial<NoteContent>) => setNote({ ...note, ...patch });
  const updateSoap = (patch: Partial<NoteContent["soap"]>) =>
    setNote({ ...note, soap: { ...note.soap, ...patch } });

  const handleSave = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveNote(props.sessionId, note);
      if (result.error) setError(result.error);
      else {
        setEditing(false);
        setFeedback("Saved");
      }
    });

  const handleApprove = () =>
    startTransition(async () => {
      setError(null);
      if (editing) await saveNote(props.sessionId, note);
      const result = await approveNote(props.sessionId);
      if (result.error) setError(result.error);
      else {
        setStatus("approved");
        setEditing(false);
        setFeedback("Note approved");
        // Approving is what releases the patient's brief, so say so.
        if (!sent) setShowShare(true);
      }
    });

  return (
    <div className="space-y-4">
      {feedback ? (
        <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {/*
        The language switch.
        ---------------------
        Only shown when there is something to switch to. The clinical record is
        the note in the session's own language; English is read-only, because a
        clinician must never be able to sign a translation they did not write.
      */}
      {translated ? (
        <div className="flex items-center gap-2 rounded-2xl bg-slate-100 p-1">
          <LangTab
            active={!showEnglish}
            onClick={() => setShowEnglish(false)}
            label={props.languageLabel}
            hint="the record"
          />
          <LangTab
            active={showEnglish}
            onClick={() => {
              setShowEnglish(true);
              setEditing(false);
            }}
            label="English"
            hint="translation"
          />
        </div>
      ) : null}

      {editing && !showEnglish ? (
        <Card className="space-y-4 p-4">
          <Field label="Summary" htmlFor="summary">
            <Textarea
              id="summary"
              rows={3}
              value={note.summary}
              onChange={(e) => update({ summary: e.target.value })}
            />
          </Field>
          {(["subjective", "objective", "assessment", "plan"] as const).map((key) => (
            <Field key={key} label={key[0]!.toUpperCase() + key.slice(1)} htmlFor={key}>
              <Textarea
                id={key}
                rows={4}
                value={note.soap[key]}
                onChange={(e) => updateSoap({ [key]: e.target.value })}
              />
            </Field>
          ))}
          <Field label="Follow-up" htmlFor="followUp">
            <Input
              id="followUp"
              value={note.followUp}
              onChange={(e) => update({ followUp: e.target.value })}
            />
          </Field>

          <div className="flex gap-2.5">
            <Button variant="secondary" full onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </Button>
            <Button full onClick={handleSave} disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </Card>
      ) : (
        <div dir={showEnglish ? "ltr" : rtl ? "rtl" : "ltr"}>
          <NoteCard
            note={viewing ?? note}
            status={status}
            patientLabel={props.patientLabel}
            dateLabel={props.dateLabel}
          />
        </div>
      )}

      {showEnglish ? (
        <p className="rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600">
          A machine translation of the note above, for a supervisor or an insurer. The record you
          sign is the {props.languageLabel} one — switch back to edit or approve it.
        </p>
      ) : null}

      {!editing && !showEnglish ? (
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button variant="secondary" full onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" aria-hidden /> Edit
          </Button>

          {status === "draft" ? (
            <Button full onClick={handleApprove} disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Check className="h-4 w-4" aria-hidden />
              )}
              Approve note
            </Button>
          ) : null}
        </div>
      ) : null}

      {/*
        There is no "send to patient" button any more, and its absence is the
        feature.
        ------------------------------------------------------------------
        A clinician emailing a chart out of the product is the single easiest
        way for clinical text to end up somewhere nobody can account for, and
        the button made it one tap. The patient now pulls their own brief: they
        rate the session on a link they already hold, give an address, and the
        brief — the plain-language section written for them, never the SOAP
        note — goes to that address automatically.

        The clinician's job is to sign the note. That is what releases it.
      */}
      {status === "approved" ? (
        <Card className="p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Mail className="h-4 w-4 text-teal-600" aria-hidden />
            {sent ? "Their summary has been sent" : "Their summary is ready to release"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {props.patientEmail
              ? `Signed. ${props.patientEmail} gets the plain-language brief — not this note — the moment they complete their session rating, or straight away if they already have.`
              : "Signed. Your patient receives the plain-language brief — not this note — when they rate the session and give us an address. Nothing is sent until they ask for it."}
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function LangTab({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "flex-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm"
          : "flex-1 rounded-xl px-3 py-2 text-sm font-medium text-slate-500"
      }
    >
      {label}
      <span className="ml-1.5 text-xs font-normal text-slate-400">{hint}</span>
    </button>
  );
}
