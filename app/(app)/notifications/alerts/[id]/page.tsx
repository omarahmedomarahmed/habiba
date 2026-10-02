import type { Metadata } from "next";
import Link from "next/link";

import { Card, PageHeader } from "@/components/clinician/kit";
import { MIN_REASON } from "@/lib/admin/reason";
import { INVESTIGATION_WINDOW_MINUTES, crisisContactGrantHolds } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import { alertForViewer, crisisContactForOnCall } from "@/lib/crisis/alerts";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
import { formatDateTime } from "@/lib/utils";

import { acknowledgeAlert, revealCrisisContact } from "./actions";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.alert"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * 🔴 F2: WHERE A CRISIS ALERT IS ACKNOWLEDGED.
 *
 * The out-of-band email and WhatsApp link here, and so does the in-app row.
 * It shows when the alert was raised, for whose patient, its level, and who
 * acknowledged it; never the patient's name or words, because a backup
 * colleague or an operator may open it too. The clinician it is for also gets
 * the way into the session (or, for a journal alert, the chart). One button
 * acknowledges it, which stops the escalation to a backup. Who may open and
 * press it is `mayAcknowledge` in `lib/crisis/escalation.ts`.
 *
 * Review: the one exception to "never the name" is break-glass, below, for
 * the platform on-call on a journal alert no clinician can act on.
 */
export default async function AlertPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ grant?: string; short?: string }>;
}) {
  const { id } = await params;
  const { grant, short } = await searchParams;
  const { t, locale } = await getI18n();
  const actor = await requireUser();
  const alert = await alertForViewer(id, actor);

  if (!alert) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={t("calert.pageTitle")} />
        <p className="px-4 pb-10 text-sm text-navy-600 sm:px-6">{t("calert.notYours")}</p>
      </div>
    );
  }

  const when = (date: Date) => formatDateTime(date, actor.timezone, locale);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("calert.pageTitle")} />
      <div className="space-y-3 px-4 pb-10 sm:px-6">
        <Card className="space-y-2 p-5">
          <p className="text-sm font-semibold text-red-800">
            {t("calert.levelLine", {
              level: ["moderate", "elevated", "high", "critical"].includes(alert.level)
                ? t(`risk.lvl.${alert.level}` as MessageKey)
                : alert.level,
            })}
          </p>
          <p className="text-sm text-navy-700">{t("calert.raisedAt", { when: when(alert.createdAt) })}</p>
          {alert.fromJournal ? <p className="text-sm text-navy-700">{t("calert.fromJournal")}</p> : null}
          {!alert.isTheirs && alert.clinician ? (
            <p className="text-sm text-navy-700">{t("calert.forPatientOf", { clinician: alert.clinician })}</p>
          ) : null}
          {alert.escalationStage > 0 ? <p className="text-sm text-navy-600">{t("calert.escalatedNote")}</p> : null}

          {alert.acknowledgedAt ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              {t("calert.acked", { who: alert.acknowledgedBy ?? "-", when: when(alert.acknowledgedAt) })}
            </p>
          ) : (
            <form action={acknowledgeAlert}>
              <input type="hidden" name="riskId" value={alert.id} />
              <button
                type="submit"
                className="tap-target h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
              >
                {t("calert.ackButton")}
              </button>
            </form>
          )}

          {alert.isTheirs && alert.sessionId ? (
            <Link href={`/sessions/${alert.sessionId}`} className="inline-block text-sm font-semibold text-navy-700 underline">
              {t("calert.openSession")}
            </Link>
          ) : null}
          {/* 🔴 0192: a journal alert opens the chart's documents, where journals are read under the grant. */}
          {alert.isTheirs && !alert.sessionId && alert.patientId ? (
            <Link
              href={`/patients/${alert.patientId}/documents`}
              className="inline-block text-sm font-semibold text-navy-700 underline"
            >
              {t("calert.openRecord")}
            </Link>
          ) : null}
        </Card>

        {alert.breakGlass ? (
          <BreakGlass riskId={alert.id} actor={actor} grant={grant} short={Boolean(short)} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * 🔴 Review: the platform on-call's way to the person behind a journal alert
 * no clinician can act on. A reason first (audited, `revealCrisisContact`),
 * then the name, phone, email and the words that raised it, and the
 * emergency numbers. Proposed protocol in docs/DECISIONS.md, for clinician
 * review.
 */
async function BreakGlass({
  riskId,
  actor,
  grant,
  short,
}: {
  riskId: string;
  actor: Awaited<ReturnType<typeof requireUser>>;
  grant: string | undefined;
  short: boolean;
}) {
  const { t } = await getI18n();
  const granted = await crisisContactGrantHolds({ grantId: grant, actorUserId: actor.userId, riskId });
  const sos = (
    <p className="text-sm text-navy-700">
      {t("calert.bgSos")}{" "}
      <Link href="/sos" className="font-semibold underline">
        {t("calert.bgSosLink")}
      </Link>
    </p>
  );

  if (!granted) {
    return (
      <Card className="space-y-3 border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-900">{t("calert.bgTitle")}</p>
        <p className="text-sm text-amber-900">{t("calert.bgIntro")}</p>
        {short ? (
          <p role="alert" className="text-sm text-rose-700">
            {t("aconfirm.tooShort")}
          </p>
        ) : grant ? (
          <p className="text-sm text-amber-900">{t("calert.bgExpired", { minutes: INVESTIGATION_WINDOW_MINUTES })}</p>
        ) : null}
        <form action={revealCrisisContact.bind(null, riskId)} className="space-y-3">
          <input
            name="why"
            required
            minLength={MIN_REASON}
            placeholder={t("aconfirm.why")}
            aria-label={t("aconfirm.why")}
            className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm"
          />
          <button type="submit" className="tap-target h-11 rounded-xl bg-navy-500 px-4 text-sm font-semibold text-white">
            {t("calert.bgReveal")}
          </button>
        </form>
        {sos}
      </Card>
    );
  }

  const contact = await crisisContactForOnCall(riskId, actor);
  if (!contact) return null;
  return (
    <Card className="space-y-2 border-amber-200 bg-amber-50 p-5">
      <p className="text-sm font-semibold text-amber-900">{t("calert.bgTitle")}</p>
      <p className="text-sm text-navy-800">{t("calert.bgName", { name: contact.name })}</p>
      {contact.phone ? <p className="text-sm text-navy-800">{t("calert.bgPhone", { phone: contact.phone })}</p> : null}
      {contact.email ? <p className="text-sm text-navy-800">{t("calert.bgEmail", { email: contact.email })}</p> : null}
      {!contact.phone && !contact.email ? <p className="text-sm text-navy-700">{t("calert.bgNoContact")}</p> : null}
      <p className="pt-2 text-xs font-bold tracking-wider text-navy-500 uppercase">{t("calert.bgExcerpt")}</p>
      {contact.excerpt ? (
        <blockquote className="text-sm leading-relaxed whitespace-pre-line text-navy-800 italic">{contact.excerpt}</blockquote>
      ) : (
        <p className="text-sm text-navy-700">{t("calert.bgGone")}</p>
      )}
      {sos}
    </Card>
  );
}
