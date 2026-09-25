import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, User } from "lucide-react";

import { CopilotChat } from "@/components/copilot/chat";
import { AccessBanner } from "@/components/patient/access-banner";
import { Card } from "@/components/clinician/kit";
import { PROMPT_TEMPLATES, promptTemplateKeys } from "@/lib/ai/case-copilot";
import { requireUser } from "@/lib/auth/guard";
import { explain } from "@/lib/access/state";
import { copilotViewFor } from "@/lib/data/copilot-view";
import { accessFor } from "@/lib/data/grants";
import { getPatientHistory } from "@/lib/data/patients";
import { fullName, relativeDay } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.copilot"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function CopilotThreadPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { locale, t } = await getI18n();
  const actor = await requireUser();
  const { patientId } = await params;

  /*
   * 🔴 76.39 — ONE LOADER, TWO SURFACES.
   *
   * This page and the patient's profile both render this thread now, and a
   * page that gathered its own quota, voice and messages is a page that can
   * disagree with the other one about them. `copilotViewFor` returns null for
   * a patient this actor may not read, which is the scope check as well as the
   * load.
   */
  const view = await copilotViewFor(actor, patientId);
  if (!view) notFound();

  const [history, access] = await Promise.all([
    getPatientHistory(actor, patientId),
    accessFor(actor, patientId),
  ]);
  const accessKey = explain(access.state, access.gated);

  const name = fullName(view.patientFirstName, view.patientLastName);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-1 px-4 pt-4 sm:px-6">
        <Link
          href="/copilot"
          className="tap-target -ms-2 flex items-center gap-1 rounded-lg px-2 text-sm font-medium text-navy-400 hover:text-navy-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("portal.copilot.title")}
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-4 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700">{name}</h1>
          <p className="mt-1 text-sm text-navy-400">
            {history.length === 1
              ? t("portal.patient.sessionsOne")
              : t("portal.patient.sessionsMany", { count: history.length })}
            {view.guidance ? ` · ${t("portal.copilot.corrected")}` : ""}
          </p>
        </div>
        {/*
          🔴 76.40 — BACK TO THE PERSON. The thread is the patient's, so it
          links to the patient: a clinician reading an answer about somebody
          should be one tap from the record it is about, in both directions.
        */}
        <Link
          href={`/patients/${patientId}`}
          className="tap-target flex items-center gap-1.5 rounded-lg border border-navy-100 px-3 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50"
        >
          <User className="h-4 w-4 text-navy-400" aria-hidden />
          {t("portal.copilot.openProfile")}
        </Link>
      </div>

      <div className="px-4 pb-10 sm:px-6">
        {/*
          7.7 — the state, said out loud, above the conversation rather than
          beside it. A therapist who does not know the copilot has been
          degraded reads a thin answer as the copilot being unhelpful.
        */}
        {accessKey ? (
          <div className="mb-4">
            <AccessBanner
              patientId={patientId}
              state={access.state}
              message={t(accessKey)}
              canRequest={access.capabilities.canRequestAccess}
              pendingSince={access.grant?.status === "pending" ? access.grant.requestedAt : null}
            />
          </div>
        ) : null}
        {history.length > 0 ? (
          <Card className="mb-4">
            <details>
              <summary className="tap-target flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-navy-700">
                <FileText className="h-4 w-4 text-navy-400" aria-hidden />
                {t("portal.copilot.history")}
                <span className="ms-auto text-xs font-normal text-navy-400">
                  {history.length}
                </span>
              </summary>
              <ul className="divide-y divide-navy-100/70 border-t border-navy-100/70">
                {history.map((session) => (
                  <li key={session.id}>
                    <Link
                      href={`/sessions/${session.id}`}
                      className="block px-4 py-3 active:bg-navy-50"
                    >
                      <p className="text-sm font-medium text-navy-700">
                        {relativeDay(session.endedAt ?? session.createdAt, actor.timezone, locale, t)}
                        {session.durationMinutes
                          ? ` · ${t("portal.minutes", { count: session.durationMinutes })}`
                          : ""}
                      </p>
                      {session.noteSummary?.summary ? (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-navy-400">
                          {session.noteSummary.summary}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        ) : null}

        <CopilotChat
          zone={actor.timezone}
          patientId={patientId}
          patientName={view.patientFirstName}
          /*
           * 45.6 — resolved here, where a translator exists. The template's
           * key stays the identifier; the label is read and the text is what
           * the thread records the clinician as having asked, so both are in
           * the language they are working in.
           */
          templates={PROMPT_TEMPLATES.map(promptTemplateKeys).map((tpl) => ({
            label: t(tpl.labelKey),
            text: t(tpl.textKey),
          }))}
          quota={view.quota}
          initialVoice={view.voice}
          initialSpeed={view.voiceSpeed}
          initialLanguage={view.replyLanguage}
          guidance={view.guidance}
          initialMessages={view.messages}
        />
      </div>
    </div>
  );
}
