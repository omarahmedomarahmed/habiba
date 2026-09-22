import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, MessageSquare } from "lucide-react";

import { PatientEditor } from "@/components/patient/patient-editor";
import { AccessBanner } from "@/components/patient/access-banner";
import { AddToHistory } from "@/components/patient/add-to-history";
import { InviteToSession } from "@/components/patient/invite-to-session";
import { RecordAccess } from "@/components/patient/record-access";
import { CopilotChat } from "@/components/copilot/chat";
import { lockedOn } from "@/lib/data/challenge";
import { Card } from "@/components/ui";
import { PROMPT_TEMPLATES, promptTemplateKeys } from "@/lib/ai/case-copilot";
import { requireUser } from "@/lib/auth/guard";
import { explain } from "@/lib/access/state";
import { recordAccess } from "@/lib/data/claims";
import { copilotViewFor } from "@/lib/data/copilot-view";
import { listDocuments } from "@/lib/data/documents";
import { accessFor } from "@/lib/data/grants";
import { getPatient, getPatientHistory } from "@/lib/data/patients";
import { hasAvatar, personIdForPatient } from "@/lib/data/people";
import { PatientAvatar } from "@/components/patient/avatar";
import { formatDate, fullName, relativeDay } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import { SessionBadge } from "@/components/sessions/status-badge";
import { NoteOrigin } from "@/components/notes/provenance";

export const metadata: Metadata = {
  title: "Patient profile",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

/**
 * 🔴 76.40 — THE PATIENT PROFILE, from the clinician's side.
 *
 * ## What this was
 *
 * A chart. A name, four editable fields, two links and a list of sessions. A
 * clinician opening it from a session got a page that mostly answered "what
 * did I call this person", when the question they arrived with is "who is
 * this, what have we done, and when are we next".
 *
 * ## What it is now, in the order somebody reads it
 *
 *   1. **Who.** Their own picture if they claimed the record and added one,
 *      their initials otherwise, with the facts underneath.
 *   2. **See them again.** One tap to a paid session, sent to them.
 *   3. **Ask about them.** The copilot's thread for this patient, inline,
 *      because a clinician reading a record should not lose their place to ask
 *      a question about it.
 *   4. **Add to their history.** Upload, type or dictate, without leaving.
 *   5. **What we have done.** Every session, newest first.
 *
 * ## 🔴 THE HEADSHOT IS A CLAIMED-ACCOUNT FACT
 *
 * `people.avatarUrl` is set by the person themselves, in their own portal,
 * after they claim the record. A clinician cannot put a face on somebody's
 * profile, and an unclaimed record therefore never has one: what shows instead
 * is their initials and what this clinician wrote down. That asymmetry is the
 * point (C115) — the photograph is theirs, and it arrives when they decide it
 * does, alongside the revocation that can take the rest away again.
 */
export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { locale, t } = await getI18n();
  const actor = await requireUser();
  const { id } = await params;

  const patient = await getPatient(actor, id);
  if (!patient) notFound();

  const history = await getPatientHistory(actor, id);

  /*
   * A patient created before sprint 5's backfill, or by a route that has not
   * been through `ensurePersonForPatient` yet, has no person row. That is not
   * an error state — the invite action creates one on demand — so the panel
   * renders as "no invite issued" rather than disappearing.
   */
  const personId = await personIdForPatient(id);
  const access = personId ? await recordAccess(personId, actor.userId) : null;

  // 7.7 — and it is shown here as well as on the copilot, because this is the
  // page with the diagnosis field on it, and that field is the one the revoked
  // state actually refuses to save.
  const consent = await accessFor(actor, id);
  const consentMessage = explain(consent.state, consent.gated);

  /*
   * 🔴 THE SAME LOADER THE COPILOT PAGE USES. Two surfaces, one thread. It
   * returns null for a patient this actor may not read, and the panel is
   * simply absent then rather than rendering an empty conversation.
   */
  const copilot = await copilotViewFor(actor, id);

  /*
   * 🔴 76.40 — WHAT THIS CLINICIAN PUT IN THE RECORD, on an unclaimed profile.
   *
   * §3's revoked state leaves a clinician "docs they uploaded themselves", and
   * the same filter is the honest summary here: this list is what YOU added,
   * so it reads the same before a claim, after a claim, and after a
   * revocation. A count that shrank the day somebody revoked would be a count
   * that was never about your own work.
   */
  const documents = personId ? await listDocuments(personId) : [];
  /* 🔴 79.4 — asked here so an empty avatar costs no request and draws no
     broken image. See `hasAvatar` in lib/data/people.ts. */
  const photo = personId ? await hasAvatar(personId) : false;
  const mine = documents.filter((row) => row.uploadedByUserId === actor.userId);

  const claimed = access?.claimed ?? false;
  const name = fullName(patient.firstName, patient.lastName);
  const initials = `${patient.firstName.charAt(0)}${patient.lastName?.charAt(0) ?? ""}`.toUpperCase();
  const lastSeen = history.find((session) => session.endedAt) ?? history[0];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-1 px-4 pt-4 sm:px-6">
        <Link
          href="/patients"
          className="tap-target -ms-2 flex items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("portal.patients.title")}
        </Link>
      </div>

      {/* ============================================================= */}
      {/*  1 · WHO                                                       */}
      {/* ============================================================= */}
      <div className="flex items-start gap-4 px-4 pt-3 pb-4 sm:px-6">
        {claimed && personId ? (
          /*
           * 🔴 79.4 — `PatientAvatar`, not a second hand-rolled `<img>`.
           *
           * This used to build its own, with a comment arguing that the route
           * "answers 404 when the person has no picture, which is why this can
           * render unconditionally". That is wrong in the one way that shows:
           * a 404 on an `<img>` is not an empty circle, it is a broken image
           * glyph, and it is a red line in the console of every clinician
           * looking at a patient who never uploaded a photo.
           *
           * The component thirty files away had already made the opposite
           * argument correctly: `hasPhoto` is asked for rather than discovered,
           * because "a 404 per empty avatar in a caseload list is a hundred
           * requests to say nothing". Two comments, both confident, one right.
           *
           * `verify:sprint25` now refuses a third copy.
           */
          <PatientAvatar
            personId={personId}
            hasPhoto={photo}
            name={patient.firstName ?? ""}
            size={64}
            className="h-16 w-16"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-semibold text-slate-600"
          >
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {history.length === 1
              ? t("portal.patient.sessionsOne")
              : t("portal.patient.sessionsMany", { count: history.length })}
            {patient.source === "join_link" ? ` · ${t("portal.patient.joinedByLink")}` : ""}
            {patient.source === "walk_in" ? ` · ${t("portal.patient.walkIn")}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {lastSeen
              ? t("pprof.lastSeen", {
                  when: relativeDay(
                    lastSeen.endedAt ?? lastSeen.createdAt,
                    actor.timezone,
                    locale,
                    t,
                  ),
                })
              : t("pprof.neverSeen")}
            {mine.length > 0 ? ` · ${t("pprof.filesYouAdded", { count: mine.length })}` : ""}
          </p>
          {/*
            🔴 THE ONE LINE THAT SAYS WHOSE RECORD THIS IS.
            Claimed means they can read their own profile and can take the
            rest of it away again; unclaimed means what is here is what this
            clinician wrote down and nobody else has seen it.
          */}
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            {claimed
              ? t("pprof.claimedNote", {
                  when: access?.claimedAt ? formatDate(access.claimedAt, actor.timezone, locale) : "",
                })
              : t("pprof.unclaimedNote")}
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 pb-10 sm:px-6">
        {consentMessage ? (
          <AccessBanner
            patientId={patient.id}
            state={consent.state}
            message={consentMessage}
            canRequest={consent.capabilities.canRequestAccess}
            pendingSince={consent.grant?.status === "pending" ? consent.grant.requestedAt : null}
          />
        ) : null}

        {/* ============================================================= */}
        {/*  2 · SEE THEM AGAIN                                            */}
        {/* ============================================================= */}
        <InviteToSession
          patientId={patient.id}
          hasPhone={Boolean(patient.phone)}
          hasEmail={Boolean(patient.email)}
        />

        <PatientEditor
          patientId={patient.id}
          initial={{
            firstName: patient.firstName,
            lastName: patient.lastName ?? "",
            email: patient.email ?? "",
            phone: patient.phone ?? "",
            diagnoses: patient.clinical?.diagnoses ?? [],
            goals: patient.clinical?.goals ?? [],
          }}
        />

        {/* ============================================================= */}
        {/*  3 · ASK ABOUT THEM                                            */}
        {/* ============================================================= */}
        {copilot ? (
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <MessageSquare className="h-4 w-4 text-slate-500" aria-hidden />
                  {t("pprof.copilot")}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  {t("pprof.copilotBlurb")}
                </p>
              </div>
              <Link
                href={`/copilot/${patient.id}`}
                className="tap-target shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t("pprof.copilotOpen")}
              </Link>
            </div>

            {/*
              🔴 THE SAME THREAD, not a second one. `copilotViewFor` returns
              the thread the copilot page renders, so a question asked here is
              in the history there and the reverse. The alternative — a fresh
              conversation per surface — is two memories of one patient, and
              the one a clinician is not looking at is the one with the
              correction in it.
            */}
            <CopilotChat
              zone={actor.timezone}
              patientId={patient.id}
              patientName={copilot.patientFirstName}
              templates={PROMPT_TEMPLATES.map(promptTemplateKeys).map((tpl) => ({
                label: t(tpl.labelKey),
                text: t(tpl.textKey),
              }))}
              quota={copilot.quota}
              initialVoice={copilot.voice}
              initialSpeed={copilot.voiceSpeed}
              initialLanguage={copilot.replyLanguage}
              guidance={copilot.guidance}
              initialMessages={copilot.messages}
            />
          </Card>
        ) : null}

        {/* ============================================================= */}
        {/*  4 · ADD TO THEIR HISTORY                                      */}
        {/* ============================================================= */}
        {consent.state !== "revoked" ? (
          <div>
            <p className="mb-2 px-1 text-sm font-semibold text-slate-900">
              {t("pprof.addToHistory")}
            </p>
            <AddToHistory patientId={patient.id} />
          </div>
        ) : null}

        {/* 8.x — the person's own record, one tap from their chart. */}
        <Card>
          <Link
            href={`/patients/${patient.id}/documents`}
            className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{t("portal.patient.profileDocs")}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {t("portal.patient.profileDocsBlurb")}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
          </Link>
        </Card>

        {/*
          33.6 — why the system believes what it believes.
          A separate screen rather than a panel on this one, because it is long
          by design: every fact carries the sentence that produced it.
        */}
        <Card>
          <Link
            href={`/patients/${patient.id}/evidence`}
            className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{t("portal.patient.beliefs")}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {t("portal.patient.beliefsBlurb")}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
          </Link>
        </Card>

        <RecordAccess
          locked={await lockedOn(id)}
          zone={actor.timezone}
          patientId={patient.id}
          claimed={claimed}
          claimedAt={access?.claimedAt ?? null}
          openInvite={access?.openInvite ?? null}
        />

        {/* ============================================================= */}
        {/*  5 · WHAT WE HAVE DONE                                         */}
        {/* ============================================================= */}
        <Card>
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            {t("portal.patient.history")}
          </p>
          {history.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">{t("portal.patient.historyNone")}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/sessions/${session.id}`}
                    className="flex items-center gap-3 px-4 py-3 active:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {relativeDay(session.endedAt ?? session.createdAt, actor.timezone, locale, t)}
                        {session.durationMinutes
                          ? ` · ${t("portal.minutes", { count: session.durationMinutes })}`
                          : ""}
                      </p>
                      {/*
                        🔴 47.3 — the NEXT clinician's view.
                        This is the list C212 describes: eight notes, three of
                        them somebody else's recollection, and until now no way
                        to tell which.
                      */}
                      {session.noteProvenance ? (
                        <span className="mt-1 flex">
                          <NoteOrigin
                            provenance={session.noteProvenance}
                            offRecordSeconds={session.noteOffRecordSeconds}
                          />
                        </span>
                      ) : null}
                      {session.noteSummary?.summary ? (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                          {session.noteSummary.summary}
                        </p>
                      ) : null}
                    </div>
                    {/*
                      37L.2 — this printed `session.status.replace("_", " ")`:
                      a database enum shown to a clinician as interface copy,
                      which no dictionary can reach and which reads as
                      "in progress" in every language. One badge, four words,
                      both languages.
                    */}
                    {session.status !== "completed" ? (
                      <SessionBadge status={session.status} />
                    ) : null}
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
