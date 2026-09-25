import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MeetingAccounts } from "@/components/settings/meeting-accounts";
import { requireUser } from "@/lib/auth/guard";
import { listConnections } from "@/lib/data/meeting-connections";
import { features } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { PROVIDERS } from "@/lib/meetings/providers";
import { formatDate } from "@/lib/utils";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.meetingAccounts"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/**
 * Connecting a meeting account. PLAN.md 41.3.
 *
 * ## 🔴 A therapist never sees an API key
 *
 * There is no input on this page. Connecting is a link to an OAuth redirect;
 * disconnecting is a button. Nothing on the screen, in the actions behind it,
 * or in `listConnections`'s shape can carry a credential, so there is no
 * version of this page where a clinician is asked to paste one or shown one.
 *
 * ## 🔴 The warning comes BEFORE the attempt
 *
 * *Many clinics block third-party Zoom apps.* A Connect button that fails
 * after an OAuth round trip, on an IT policy nobody here can change, is a
 * clinician who now believes the product is broken. Each provider says what
 * might stop it, in its own words, because the reason differs: Zoom is a
 * clinic account policy, Google needs Workspace admin approval, Teams needs
 * tenant consent.
 *
 * And beside it, the thing that makes all of that survivable: the 24Therapy
 * room already works and needs nothing set up. Nothing about running sessions
 * depends on this page.
 */
export default async function IntegrationsSettingsPage() {
  const actor = await requireUser();
  const { t, locale } = await getI18n();

  const connections = await listConnections(actor);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-1">
        <Link
          href="/settings"
          className="tap-target -ms-2 flex items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("portal.nav.settings")}
        </Link>
      </div>

      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t("portal.meet.title")}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("portal.meet.body")}</p>
      </div>

      <MeetingAccounts
        available={features.meetingBots}
        providers={Object.values(PROVIDERS).map((spec) => ({
          provider: spec.provider,
          name: spec.name,
          mayBeBlocked: spec.mayBeBlocked,
        }))}
        connections={connections.map((connection) => ({
          provider: connection.provider,
          accountLabel: connection.accountLabel,
          connectedAt: formatDate(connection.connectedAt, actor.timezone, locale),
        }))}
      />
    </div>
  );
}
