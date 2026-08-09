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
  shareReport,
} from "@/app/(app)/sessions/actions";
import type { NoteContent } from "@/lib/db/schema";

type Props = {
  sessionId: string;
  initialNote: NoteContent | null;
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
        // Approving is the natural moment to offer the last step.
        if (!sent) setShowShare(true);
      }
    });

  const handleShare = () =>
    startTransition(async () => {
      setError(null);
      const result = await shareReport(props.sessionId, email.trim() || undefined);
      if (result.error) setError(result.error);
      else {
        setSent(true);
        setShowShare(false);
        setFeedback(result.message ?? "Sent");
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

      {editing ? (
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
        <NoteCard
          note={note}
          status={status}
          patientLabel={props.patientLabel}
          dateLabel={props.dateLabel}
        />
      )}

      {!editing ? (
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
          ) : (
            <Button
              variant={sent ? "secondary" : "teal"}
              full
              onClick={() => setShowShare((v) => !v)}
            >
              <Mail className="h-4 w-4" aria-hidden />
              {sent ? "Send again" : "Send to patient"}
            </Button>
          )}
        </div>
      ) : null}

      {showShare ? (
        <Card className="space-y-3 p-4">
          <p className="text-sm font-semibold text-slate-900">Email a summary to your patient</p>
          <p className="text-xs leading-relaxed text-slate-500">
            They receive the summary, what you discussed and what to work on. Your clinical
            impressions and the assessment stay in the chart.
          </p>
          <Field label="Send to" htmlFor="shareEmail">
            <Input
              id="shareEmail"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
            />
          </Field>
          <div className="flex gap-2.5">
            <Button variant="secondary" full onClick={() => setShowShare(false)}>
              Not now
            </Button>
            <Button variant="teal" full onClick={handleShare} disabled={pending || !email.trim()}>
              {pending ? "Sending…" : "Send summary"}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
