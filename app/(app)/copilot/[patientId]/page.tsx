import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";

import { CopilotChat } from "@/components/copilot/chat";
import { AccessBanner } from "@/components/patient/access-banner";
import { Card } from "@/components/ui";
import { PROMPT_TEMPLATES, promptTemplateKeys } from "@/lib/ai/case-copilot";
import { requireUser } from "@/lib/auth/guard";
import { explain } from "@/lib/access/state";
import { checkQuota, getMessages, getOrCreateThread } from "@/lib/data/copilot";
import { accessFor } from "@/lib/data/grants";
import { getPatientHistory } from "@/lib/data/patients";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { fullName, relativeDay } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(app)/copilot/[patientId]/page.tsx", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


export const metadata: Metadata = { title: "Copilot", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CopilotThreadPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { locale, t } = await getI18n();
  const actor = await requireUser();
  const { patientId } = await params;

  const found = await getOrCreateThread(actor, patientId);
  if (!found) notFound();

  const [messages, quota, history, access, [me]] = await Promise.all([
    getMessages(actor, found.thread.id),
    checkQuota(actor, found.thread.id),
    getPatientHistory(actor, patientId),
    accessFor(actor, patientId),
    db.select({ profile: users.profile }).from(users).where(eq(users.id, actor.userId)).limit(1),
  ]);

  const name = fullName(found.patient.firstName, found.patient.lastName);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-1 px-4 pt-4 sm:px-6">
        <Link
          href="/copilot"
          className="tap-target -ms-2 flex items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("portal.copilot.title")}
        </Link>
      </div>

      <div className="px-4 pt-3 pb-4 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {history.length} session{history.length === 1 ? "" : "s"} on record
          {found.thread.guidance ? " · corrections applied" : ""}
        </p>
      </div>

      <div className="px-4 pb-10 sm:px-6">
        {/*
          7.7 — the state, said out loud, above the conversation rather than
          beside it. A therapist who does not know the copilot has been
          degraded reads a thin answer as the copilot being unhelpful.
        */}
        {explain(access.state, access.gated) ? (
          <div className="mb-4">
            <AccessBanner
              patientId={patientId}
              state={access.state}
              message={explain(access.state, access.gated)!}
              canRequest={access.capabilities.canRequestAccess}
              pendingSince={access.grant?.status === "pending" ? access.grant.requestedAt : null}
            />
          </div>
        ) : null}
        {history.length > 0 ? (
          <Card className="mb-4">
            <details>
              <summary className="tap-target flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-800">
                <FileText className="h-4 w-4 text-slate-400" aria-hidden />
                {t("portal.copilot.history")}
                <span className="ms-auto text-xs font-normal text-slate-400">
                  {history.length}
                </span>
              </summary>
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {history.map((session) => (
                  <li key={session.id}>
                    <Link
                      href={`/sessions/${session.id}`}
                      className="block px-4 py-3 active:bg-slate-50"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {relativeDay(session.endedAt ?? session.createdAt, actor.timezone, locale, t)}
                        {session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}
                      </p>
                      {session.noteSummary?.summary ? (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
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
          patientName={found.patient.firstName}
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
          quota={{ used: quota.used, limit: quota.limit }}
          initialVoice={me?.profile?.voice ?? "british_female"}
          initialSpeed={me?.profile?.voiceSpeed ?? 1}
          initialLanguage={found.thread.replyLanguage}
          guidance={found.thread.guidance}
          initialMessages={messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            citations: m.citations,
            createdAt: m.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
