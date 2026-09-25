"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Mail, Pencil, Plus, RefreshCw, Sparkles, Trash2, User } from "lucide-react";

import { NoteCard } from "@/components/clinical/note-card";
import { PatientBriefCard } from "@/components/clinical/patient-brief-card";
import { Button, Card, Field, Input, Textarea } from "@/components/clinician/kit";
import {
  addNoteAddendum,
  approveNote,
  approvePatientNote,
  regenerateNote,
  saveNote,
  startOwnNote,
  savePatientNote,
} from "@/app/(app)/sessions/actions";
import { RTL_LANGUAGES, type NoteContent } from "@/lib/db/schema";
import { sectionLabelKey, type NoteView } from "@/lib/notes/formats";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

type Props = {
  sessionId: string;
  /** W2-F01: which of the session's notes this is; null before one exists. */
  noteId: string | null;
  /** W2-F01: its format, for the headings. */
  formatKey: string;
  initialNote: NoteContent | null;
  /**
   * W2-F01: the session's one patient copy, from its primary note. The same
   * whichever format is on screen.
   */
  initialCopy: PatientCopy | null;
  /** W2-T03: what the note area shows, decided by `noteView`. */
  view: NoteView;
  /** W2-T04: a draft with a transcript behind it can be written again. */
  canRedraft: boolean;
  /** ISO 639-1 of the language the session was held in. */
  language: string;
  languageLabel: string;
  /** English rendering, when the session was not in English. */
  contentEn: NoteContent | null;
  initialStatus: "draft" | "approved";
  /** The patient's copy is signed separately from the chart. */
  initialPatientStatus: "draft" | "approved";
  noteStatus: "none" | "generating" | "ready" | "failed";
  /** Task 123 — why there may be nothing to write from. */
  recordingConsent?: "granted" | "declined" | null;
  patientLabel: string;
  patientEmail: string | null;
  dateLabel: string;
  reportSent: boolean;
  /**
   * 26.3 / C112 — whether this component owns approving.
   *
   * False when the session page renders `SessionApproval` above it, which is
   * the one screen, one action, three items C112 asks for. Two approval
   * surfaces for the same document is the approval fatigue the ruling is
   * about, so this component becomes an editor and nothing else.
   *
   * Defaulted to true so that any other caller keeps the behaviour it had.
   */
  approvals?: boolean;
  /** W1-03: what was added after each half was signed, oldest first. */
  clinicalAddenda?: AddendumLine[];
  patientAddenda?: AddendumLine[];
};

/** Formatted on the server, in the reader's zone. */
export type AddendumLine = { id: string; by: string; when: string; body: string };

export type PatientCopy = Pick<NoteContent, "patientBrief" | "patientSteps" | "patientNext">;

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
  const t = useT();
  const [pending, startTransition] = useTransition();

  const [note, setNote] = useState<NoteContent | null>(props.initialNote);
  const [copy, setCopy] = useState<PatientCopy | null>(props.initialCopy);
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
    if (props.view !== "writing") return;
    const poll = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(poll);
  }, [props.view, router]);

  useEffect(() => {
    setNote(props.initialNote);
    setCopy(props.initialCopy);
    setStatus(props.initialStatus);
    setPatientStatus(props.initialPatientStatus);
  }, [props.initialNote, props.initialCopy, props.initialStatus, props.initialPatientStatus]);

  /*
   * 🔴 W2-T03: "Writing your note" only while a job is really writing one. A
   * cancelled session shows nothing, and a job that died offers a way on.
   */
  if (props.view === "none") return null;

  if (props.view === "writing") {
    return (
      <Card className="space-y-4 p-6">
        <p className="flex items-center gap-2 text-[16px] font-bold text-navy-700">
          <Sparkles className="h-5 w-5 animate-pulse text-brand-700" aria-hidden />
          {t("tnote.writing")}
        </p>
        <p className="text-sm text-navy-400">{t("tnote.writingBody")}</p>
        <div className="space-y-3 pt-1" aria-hidden>
          {[90, 76, 84, 60].map((width) => (
            <div key={width} className="h-3.5 animate-pulse rounded-full bg-navy-100" style={{ width: `${width}%` }} />
          ))}
        </div>
      </Card>
    );
  }

  if (props.view === "failed" || !note) {
    /*
     * 🔴 Task 123 — "not recorded" is not "failed". Without a standing yes
     * nothing was captured on purpose, so "try again" can never succeed; the
     * clinician writes the note themselves, as every note was before
     * recordings.
     */
    const notRecorded = props.recordingConsent !== "granted";
    const writeOwn = (
      <Button
        variant={notRecorded ? "primary" : "secondary"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await startOwnNote(props.sessionId);
            router.refresh();
          })
        }
      >
        <Pencil className="h-4 w-4" aria-hidden /> {t("tnote.writeOwn")}
      </Button>
    );
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-50 text-navy-500 ring-1 ring-navy-100" aria-hidden>
          <Pencil className="h-6 w-6" />
        </span>
        <p className="text-[17px] font-bold text-navy-700">
          {notRecorded ? t("tnote.notRecorded") : t("tnote.failed")}
        </p>
        <p className="max-w-sm text-sm text-navy-400">
          {notRecorded ? t("tnote.notRecordedBody", { name: props.patientLabel }) : t("tnote.failedBody")}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {notRecorded ? null : (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  /* 🔴 T17: a refusal (the note is signed) is said, not swallowed. */
                  const result = await regenerateNote(props.sessionId);
                  setError(result.error ?? null);
                  router.refresh();
                })
              }
            >
              <RefreshCw className="h-4 w-4" aria-hidden /> {t("tnote.tryAgain")}
            </Button>
          )}
          {writeOwn}
        </div>
        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </Card>
    );
  }

  const update = (patch: Partial<NoteContent>) => setNote({ ...note, ...patch });
  const updateSoap = (patch: Partial<NoteContent["soap"]>) =>
    setNote({ ...note, soap: { ...note.soap, ...patch } });
  /* W2-F01: one section of a note in another format. */
  const updateSection = (key: string, text: string) =>
    setNote({
      ...note,
      sections: (note.sections ?? []).map((s) => (s.key === key ? { ...s, text } : s)),
    });
  const updateCopy = (patch: Partial<PatientCopy>) =>
    setCopy({ patientBrief: "", patientSteps: [], patientNext: "", ...copy, ...patch });

  // Older notes predate these fields; treat a missing one as empty rather than
  // letting `.map` throw inside a clinician's workflow.
  const brief = copy?.patientBrief ?? "";
  const steps = copy?.patientSteps ?? [];
  const patientNext = copy?.patientNext ?? "";

  const handleSave = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveNote(props.sessionId, note, props.noteId);
      if (result.error) setError(result.error);
      else {
        setEditing(false);
        setFeedback(t("common.saved"));
      }
    });

  const handleApprove = () =>
    startTransition(async () => {
      setError(null);
      if (editing) await saveNote(props.sessionId, note, props.noteId);
      const result = await approveNote(props.sessionId, props.noteId);
      if (result.error) setError(result.error);
      else {
        setStatus("approved");
        setEditing(false);
        setFeedback(
          patientStatus === "approved" ? t("tnote.signed") : t("tnote.signedPending"),
        );
        // The other half is the one that reaches a person, so point at it.
        if (patientStatus !== "approved") setTab("patient");
      }
    });

  const handleSaveBrief = () =>
    startTransition(async () => {
      setError(null);
      const result = await savePatientNote(props.sessionId, {
        patientBrief: brief,
        patientSteps: steps,
        patientNext,
      });
      if (result.error) setError(result.error);
      else {
        setEditingBrief(false);
        setFeedback(t("common.saved"));
      }
    });

  const handleApproveBrief = () =>
    startTransition(async () => {
      setError(null);
      if (editingBrief) {
        const saved = await savePatientNote(props.sessionId, {
          patientBrief: brief,
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
        setFeedback(t("tnote.released"));
      }
    });

  return (
    <div className="space-y-4">
      {feedback ? (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-navy-700 px-4 py-3 text-sm font-semibold text-white shadow-lg">
          <Check className="h-4 w-4 shrink-0 text-brand-300" aria-hidden />
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {/* --------------------------------------------------- the two documents */}
      <div className="flex items-stretch gap-1.5 rounded-3xl bg-white p-1.5 ring-1 ring-navy-100">
        <DocTab
          active={tab === "clinical"}
          onClick={() => setTab("clinical")}
          icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}
          label={t("tnote.clinicalTab")}
          state={status === "approved" ? t("tnote.stateSigned") : t("tnote.stateDraft")}
          done={status === "approved"}
        />
        <DocTab
          active={tab === "patient"}
          onClick={() => setTab("patient")}
          icon={<User className="h-3.5 w-3.5" aria-hidden />}
          label={t("tnote.patientTab")}
          state={
            patientStatus === "approved"
              ? sent
                ? t("tnote.stateSent")
                : t("tnote.stateReleased")
              : t("tnote.stateNotApproved")
          }
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
            <div className="flex items-center gap-1.5 rounded-full bg-white p-1 ring-1 ring-navy-100">
              <LangTab
                active={!showEnglish}
                onClick={() => setShowEnglish(false)}
                label={props.languageLabel}
                hint={t("tnote.theRecord")}
              />
              <LangTab
                active={showEnglish}
                onClick={() => {
                  setShowEnglish(true);
                  setEditing(false);
                }}
                label={t("tcop.english")}
                hint={t("tnote.translation")}
              />
            </div>
          ) : null}

          {editing && !showEnglish ? (
            <Card className="space-y-4 p-4">
              <Field label={t("tnote.summary")} htmlFor="summary">
                <Textarea
                  id="summary"
                  rows={3}
                  value={note.summary}
                  onChange={(e) => update({ summary: e.target.value })}
                />
              </Field>
              {/* W2-F01: a note in another format edits its own sections. */}
              {note.sections?.length
                ? note.sections.map((section) => {
                    const labelKey = sectionLabelKey(props.formatKey, section.key);
                    return (
                      <Field
                        key={section.key}
                        label={labelKey ? t(labelKey) : section.label}
                        htmlFor={`section-${section.key}`}
                      >
                        <Textarea
                          id={`section-${section.key}`}
                          rows={4}
                          value={section.text}
                          onChange={(e) => updateSection(section.key, e.target.value)}
                        />
                      </Field>
                    );
                  })
                : (["subjective", "objective", "assessment", "plan"] as const).map((key) => (
                    <Field key={key} label={t(SOAP_LABELS[key])} htmlFor={key}>
                      <Textarea
                        id={key}
                        rows={4}
                        value={note.soap[key]}
                        onChange={(e) => updateSoap({ [key]: e.target.value })}
                      />
                    </Field>
                  ))}
              <Field label={t("tnote.followUp")} htmlFor="followUp">
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
                  {t("common.cancel")}
                </Button>
                <Button full onClick={handleSave} disabled={pending}>
                  {pending ? t("common.saving") : t("tnote.saveChanges")}
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
                formatKey={props.formatKey}
              />
            </div>
          )}

          {showEnglish ? (
            <p className="rounded-xl bg-navy-50 px-3.5 py-2.5 text-xs leading-relaxed text-navy-400">
              {/* W1-03: an English fragment used to print before this key. */}
              {t("tnote.machineNote", { language: props.languageLabel })}
            </p>
          ) : null}

          {status === "approved" && !showEnglish ? (
            <Addenda
              sessionId={props.sessionId}
              noteId={props.noteId}
              kind="clinical"
              lines={props.clinicalAddenda ?? []}
              onAdded={() => {
                setFeedback(t("common.saved"));
                router.refresh();
              }}
            />
          ) : null}

          {!editing && !showEnglish && status === "draft" ? (
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button variant="secondary" full onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" aria-hidden /> {t("tnote.edit")}
              </Button>

              {/*
                🔴 W2-T04: written again from the transcript, after a voice or a
                line was put right. It was offered only after a failure, so a
                correction never reached the note.
              */}
              {props.canRedraft ? (
                <Button
                  variant="secondary"
                  full
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      setError(null);
                      const result = await regenerateNote(props.sessionId, props.noteId);
                      if (result.error) setError(result.error);
                      router.refresh();
                    })
                  }
                >
                  <RefreshCw className="h-4 w-4" aria-hidden /> {t("tnf.redraft")}
                </Button>
              ) : null}

              {status === "draft" && props.approvals !== false ? (
                <Button full onClick={handleApprove} disabled={pending}>
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden />
                  )}
                  {t("tnote.sign")}
                </Button>
              ) : null}
            </div>
          ) : null}

          {status === "approved" ? (
            <p className="px-1 text-xs leading-relaxed text-navy-400">
              {t("tnote.signedNote")}
            </p>
          ) : null}
        </>
      ) : (
        /* ------------------------------------------------ the patient's copy */
        <>
          {editingBrief ? (
            <Card className="space-y-4 p-4">
              <Field label={t("tnote.talkedAbout")} htmlFor="patientBrief">
                <Textarea
                  id="patientBrief"
                  rows={7}
                  value={brief}
                  onChange={(e) => updateCopy({ patientBrief: e.target.value })}
                />
              </Field>

              <StepEditor
                steps={steps}
                onChange={(next) => updateCopy({ patientSteps: next })}
                disabled={pending}
              />

              <Field label={t("tnote.whatNext")} htmlFor="patientNext">
                <Input
                  id="patientNext"
                  value={patientNext}
                  onChange={(e) => updateCopy({ patientNext: e.target.value })}
                />
              </Field>

              <div className="flex gap-2.5">
                <Button
                  variant="secondary"
                  full
                  onClick={() => setEditingBrief(false)}
                  disabled={pending}
                >
                  {t("common.cancel")}
                </Button>
                <Button full onClick={handleSaveBrief} disabled={pending}>
                  {pending ? t("common.saving") : t("tnote.saveChanges")}
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3 border-b border-navy-100/70 pb-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-700">
                    {t("tnote.receives", { name: props.patientLabel })}
                  </p>
                  <p className="mt-0.5 text-xs text-navy-400">
                    {t("tnote.receivesBody")}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                    patientStatus === "approved"
                      ? "bg-brand-50 text-brand-800"
                      : "bg-amber-50 text-amber-800",
                  )}
                >
                  {patientStatus === "approved" ? t("tnote.approved") : t("tnote.stateDraft")}
                </span>
              </div>

              <PatientBriefCard
                className="pt-4"
                brief={brief}
                steps={steps}
                next={patientNext}
                rtl={rtl}
              />
            </Card>
          )}

          {patientStatus === "approved" ? (
            <Addenda
              sessionId={props.sessionId}
              kind="patient"
              lines={props.patientAddenda ?? []}
              onAdded={() => {
                setFeedback(t("common.saved"));
                router.refresh();
              }}
            />
          ) : null}

          {!editingBrief && patientStatus === "draft" ? (
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button variant="secondary" full onClick={() => setEditingBrief(true)}>
                <Pencil className="h-4 w-4" aria-hidden /> {t("tnote.editCopy")}
              </Button>

              {patientStatus === "draft" && props.approvals !== false ? (
                <Button variant="primary" full onClick={handleApproveBrief} disabled={pending}>
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden />
                  )}
                  {t("tnote.approveAndSend")}
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
              <p className="flex items-center gap-2 text-sm font-semibold text-navy-700">
                <Mail className="h-4 w-4 text-brand-700" aria-hidden />
                {sent ? t("tnote.sentTitle") : t("tnote.releasedTitle")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-navy-400">
                {props.patientEmail
                  ? t("tnote.sentBody", { email: props.patientEmail })
                  : t("tnote.releasedBody")}
              </p>
            </Card>
          ) : (
            <p className="px-1 text-xs leading-relaxed text-navy-400">
              {t("tnote.nothingSent")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 🔴 W1-03 / P4: after signing, a change is an addendum.
 *
 * The signed text above stays exactly as it was signed. What is added here is
 * kept under it with the author's name and the time, in order, and cannot be
 * edited or removed: the button that used to say Edit says this instead.
 */
function Addenda({
  sessionId,
  noteId = null,
  kind,
  lines,
  onAdded,
}: {
  sessionId: string;
  /** W2-F01: the note a clinical addendum amends. The copy's is the session's. */
  noteId?: string | null;
  kind: "clinical" | "patient";
  lines: AddendumLine[];
  onAdded: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await addNoteAddendum(sessionId, kind, body, noteId);
      if (result.error) setError(result.error);
      else {
        setBody("");
        setOpen(false);
        onAdded();
      }
    });

  return (
    <div className="space-y-2.5">
      {lines.length > 0 ? (
        <Card className="space-y-3 p-4">
          <p className="text-sm font-semibold text-navy-700">{t("tnote.addenda")}</p>
          <ol className="space-y-3">
            {lines.map((line) => (
              <li key={line.id} className="border-s-2 border-navy-100 ps-3">
                <p className="text-xs text-navy-400">
                  {t("tnote.addendumBy", { name: line.by, when: line.when })}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-navy-600">
                  {line.body}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {open ? (
        <Card className="space-y-3 p-4">
          <Field label={t("tnote.addAddendum")} htmlFor={`addendum-${kind}`} hint={t("tnote.addendumHint")}>
            <Textarea
              id={`addendum-${kind}`}
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
          <div className="flex gap-2.5">
            <Button variant="secondary" full onClick={() => setOpen(false)} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button full onClick={save} disabled={pending || !body.trim()}>
              {pending ? t("common.saving") : t("tnote.addendumSave")}
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="secondary" full onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> {t("tnote.addAddendum")}
        </Button>
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

/* The SOAP headings, as keys. They were built by capitalising the field name,
   which produces an English word from a database key and nothing a translator
   can reach. 37L.2. */
const SOAP_LABELS = {
  subjective: "tnote.subjective",
  objective: "tnote.objective",
  assessment: "tnote.assessment",
  plan: "tnote.plan",
} as const satisfies Record<"subjective" | "objective" | "assessment" | "plan", MessageKey>;

function StepEditor({
  steps,
  onChange,
  disabled,
}: {
  steps: string[];
  onChange: (steps: string[]) => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-navy-600">{t("tnote.beforeNext")}</p>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={index} className="flex items-start gap-2">
            {/* A textarea's intrinsic width comes from `cols`, so it needs
                `min-w-0` to shrink inside the row rather than push the delete
                button off a narrow screen. */}
            <Textarea
              className="min-w-0 flex-1"
              rows={2}
              aria-label={t("tnote.stepLabel", { number: index + 1 })}
              value={step}
              onChange={(e) =>
                onChange(steps.map((s, i) => (i === index ? e.target.value : s)))
              }
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(steps.filter((_, i) => i !== index))}
              aria-label={t("tnote.removeStep", { number: index + 1 })}
              className="tap-target mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-navy-400 hover:bg-navy-50 hover:text-red-600"
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
          className="mt-2 flex items-center gap-1.5 rounded-lg px-1 py-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          <Plus className="h-4 w-4" aria-hidden /> {t("tnote.addStep")}
        </button>
      ) : (
        <p className="mt-2 px-1 text-xs text-navy-400">
          {t("tnote.maxSteps")}
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
        "flex min-w-0 flex-1 flex-col gap-1 rounded-2xl px-3.5 py-2.5 text-start transition-colors",
        active ? "bg-navy-600 shadow-[0_8px_24px_-12px_rgba(3,11,23,0.6)]" : "hover:bg-navy-50",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 truncate text-[15px] font-bold",
          active ? "text-white" : "text-navy-500",
        )}
      >
        {icon}
        {label}
      </span>
      <span
        className={cn(
          "w-fit max-w-full truncate rounded-full px-2 py-0.5 text-xs font-semibold",
          done ? "bg-brand-50 text-brand-800" : "bg-amber-50 text-amber-800",
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
          ? "flex-1 rounded-full bg-navy-50 px-3 py-2 text-sm font-bold text-navy-700 ring-1 ring-navy-100"
          : "flex-1 rounded-full px-3 py-2 text-sm font-medium text-navy-400 hover:text-navy-700"
      }
    >
      {label}
      <span className="ms-1.5 text-xs font-normal text-navy-400">{hint}</span>
    </button>
  );
}
