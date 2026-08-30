"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Mail, Pencil, Plus, RefreshCw, Sparkles, Trash2, User } from "lucide-react";

import { NoteCard } from "@/components/clinical/note-card";
import { PatientBriefCard } from "@/components/clinical/patient-brief-card";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import {
  approveNote,
  approvePatientNote,
  regenerateNote,
  saveNote,
  savePatientNote,
} from "@/app/(app)/sessions/actions";
import { RTL_LANGUAGES, type NoteContent } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type Props = {
  sessionId: string;
  initialNote: NoteContent | null;
  /** ISO 639-1 of the language the session was held in. */
  language: string;
  languageLabel: string;
  /** English rendering, when the session was not in English. */
  contentEn: NoteContent | null;
  initialStatus: "draft" | "approved";
  /** The patient's copy is signed separately from the chart. */
  initialPatientStatus: "draft" | "approved";
  noteStatus: "none" | "generating" | "ready" | "failed";
  patientLabel: string;
  patientEmail: string | null;
  dateLabel: string;
  reportSent: boolean;
};

/**
 * Two documents, two signatures.
 *
 * The chart and the patient's copy come out of one generation pass and used to
 * be approved by one button, which meant a clinician who wanted to get the
 * plain-language summary to somebody tonight had to finish the formal write-up
 * first — and a clinician who signed the chart quickly released a patient
 * summary they had not necessarily read.
 *
 * They are separate tabs now because they are separate audiences. The tab
 * headers carry each side's state so nobody has to open one to find out whether
 * it still needs them.
 */
export function NoteReview(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [note, setNote] = useState<NoteContent | null>(props.initialNote);
  const [status, setStatus] = useState(props.initialStatus);
  const [patientStatus, setPatientStatus] = useState(props.initialPatientStatus);
  const [tab, setTab] = useState<"clinical" | "patient">("clinical");
  const [editing, setEditing] = useState(false);
  const [editingBrief, setEditingBrief] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent] = useState(props.reportSent);
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
    setPatientStatus(props.initialPatientStatus);
  }, [props.initialNote, props.initialStatus, props.initialPatientStatus]);

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

  // Older notes predate these fields; treat a missing one as empty rather than
  // letting `.map` throw inside a clinician's workflow.
  const steps = note.patientSteps ?? [];
  const patientNext = note.patientNext ?? "";

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
        setFeedback(
          patientStatus === "approved"
            ? "Clinical note signed"
            : "Clinical note signed. Their summary is still yours to approve.",
        );
        // The other half is the one that reaches a person, so point at it.
        if (patientStatus !== "approved") setTab("patient");
      }
    });

  const handleSaveBrief = () =>
    startTransition(async () => {
      setError(null);
      const result = await savePatientNote(props.sessionId, {
        patientBrief: note.patientBrief,
        patientSteps: steps,
        patientNext,
      });
      if (result.error) setError(result.error);
      else {
        setEditingBrief(false);
        setFeedback("Saved");
      }
    });

  const handleApproveBrief = () =>
    startTransition(async () => {
      setError(null);
      if (editingBrief) {
        const saved = await savePatientNote(props.sessionId, {
          patientBrief: note.patientBrief,
          patientSteps: steps,
          patientNext,
        });
        if (saved.error) {
          setError(saved.error);
          return;
        }
      }
      const result = await approvePatientNote(props.sessionId);
      if (result.error) setError(result.error);
      else {
        setPatientStatus("approved");
        setEditingBrief(false);
        setFeedback("Approved — their summary is released");
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

      {/* --------------------------------------------------- the two documents */}
      <div className="flex items-stretch gap-2 rounded-2xl bg-slate-100 p-1">
        <DocTab
          active={tab === "clinical"}
          onClick={() => setTab("clinical")}
          icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}
          label="Clinical note"
          state={status === "approved" ? "Signed" : "Draft"}
          done={status === "approved"}
        />
        <DocTab
          active={tab === "patient"}
          onClick={() => setTab("patient")}
          icon={<User className="h-3.5 w-3.5" aria-hidden />}
          label="Their summary"
          state={patientStatus === "approved" ? (sent ? "Sent" : "Released") : "Not approved"}
          done={patientStatus === "approved"}
        />
      </div>

      {tab === "clinical" ? (
        <>
          {/*
            The language switch.
            ---------------------
            Only shown when there is something to switch to. The clinical record
            is the note in the session's own language; English is read-only,
            because a clinician must never be able to sign a translation they
            did not write.
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
                <Button
                  variant="secondary"
                  full
                  onClick={() => setEditing(false)}
                  disabled={pending}
                >
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
              A machine translation of the note above, for a supervisor or an insurer. The record
              you sign is the {props.languageLabel} one — switch back to edit or approve it.
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
                  Sign the note
                </Button>
              ) : null}
            </div>
          ) : null}

          {status === "approved" ? (
            <p className="px-1 text-xs leading-relaxed text-slate-500">
              Signed. This stays in the chart — nothing on this tab is ever sent to a patient.
            </p>
          ) : null}
        </>
      ) : (
        /* ------------------------------------------------ the patient's copy */
        <>
          {editingBrief ? (
            <Card className="space-y-4 p-4">
              <Field label="What you talked about" htmlFor="patientBrief">
                <Textarea
                  id="patientBrief"
                  rows={7}
                  value={note.patientBrief}
                  onChange={(e) => update({ patientBrief: e.target.value })}
                />
              </Field>

              <StepEditor
                steps={steps}
                onChange={(next) => update({ patientSteps: next })}
                disabled={pending}
              />

              <Field label="What happens next" htmlFor="patientNext">
                <Input
                  id="patientNext"
                  value={patientNext}
                  onChange={(e) => update({ patientNext: e.target.value })}
                />
              </Field>

              <div className="flex gap-2.5">
                <Button
                  variant="secondary"
                  full
                  onClick={() => setEditingBrief(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button full onClick={handleSaveBrief} disabled={pending}>
                  {pending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    What {props.patientLabel} receives
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Word for word. Nothing else from this session leaves the practice.
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                    patientStatus === "approved"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600",
                  )}
                >
                  {patientStatus === "approved" ? "Approved" : "Draft"}
                </span>
              </div>

              <PatientBriefCard
                className="pt-4"
                brief={note.patientBrief}
                steps={steps}
                next={patientNext}
                rtl={rtl}
              />
            </Card>
          )}

          {!editingBrief ? (
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button variant="secondary" full onClick={() => setEditingBrief(true)}>
                <Pencil className="h-4 w-4" aria-hidden /> Edit their copy
              </Button>

              {patientStatus === "draft" ? (
                <Button variant="teal" full onClick={handleApproveBrief} disabled={pending}>
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden />
                  )}
                  Approve and send
                </Button>
              ) : null}
            </div>
          ) : null}

          {/*
            There is no "send to any address" button here, and its absence is
            the feature.
            ------------------------------------------------------------------
            A clinician emailing a chart out of the product is the single
            easiest way for clinical text to end up somewhere nobody can account
            for, and it used to be one tap. Approving releases this summary — and
            only this summary — to the address the patient gave us themselves.
          */}
          {patientStatus === "approved" ? (
            <Card className="p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Mail className="h-4 w-4 text-teal-600" aria-hidden />
                {sent ? "Their summary has been sent" : "Their summary is released"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {props.patientEmail
                  ? `${props.patientEmail} gets exactly what is above — not the clinical note — the moment they complete their session rating, or straight away if they already have. If they have not, we email them once to say it is waiting.`
                  : "Your patient receives exactly what is above — not the clinical note — when they rate the session and give us an address. Nothing is sent until they ask for it."}
              </p>
            </Card>
          ) : (
            <p className="px-1 text-xs leading-relaxed text-slate-500">
              Nothing has been sent. Approving this is what releases it — the clinical note is
              never part of it, whether or not it is signed.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The steps editor.
 *
 * A list rather than a textarea because the list is the point: three separate
 * things a person can tick off, not a paragraph with semicolons in it. Capped
 * at four in the same place the model is capped, so a clinician cannot
 * accidentally produce the wall of homework the cap exists to prevent.
 */
const MAX_STEPS = 4;

function StepEditor({
  steps,
  onChange,
  disabled,
}: {
  steps: string[];
  onChange: (steps: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700">Before we next meet</p>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={index} className="flex items-start gap-2">
            {/* A textarea's intrinsic width comes from `cols`, so it needs
                `min-w-0` to shrink inside the row rather than push the delete
                button off a narrow screen. */}
            <Textarea
              className="min-w-0 flex-1"
              rows={2}
              aria-label={`Step ${index + 1}`}
              value={step}
              onChange={(e) =>
                onChange(steps.map((s, i) => (i === index ? e.target.value : s)))
              }
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(steps.filter((_, i) => i !== index))}
              aria-label={`Remove step ${index + 1}`}
              className="tap-target mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>

      {steps.length < MAX_STEPS ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...steps, ""])}
          className="mt-2 flex items-center gap-1.5 rounded-lg px-1 py-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add a step
        </button>
      ) : (
        <p className="mt-2 px-1 text-xs text-slate-400">
          Four is the most anybody starts. Cut one to add another.
        </p>
      )}
    </div>
  );
}

function DocTab({
  active,
  onClick,
  icon,
  label,
  state,
  done,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  state: string;
  done: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl px-3 py-2 text-start transition-colors",
        active ? "bg-white shadow-sm" : "hover:bg-white/50",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 truncate text-sm font-semibold",
          active ? "text-slate-900" : "text-slate-500",
        )}
      >
        {icon}
        {label}
      </span>
      <span
        className={cn(
          "truncate text-xs font-medium",
          done ? "text-emerald-600" : "text-amber-600",
        )}
      >
        {state}
      </span>
    </button>
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
      <span className="ms-1.5 text-xs font-normal text-slate-400">{hint}</span>
    </button>
  );
}
