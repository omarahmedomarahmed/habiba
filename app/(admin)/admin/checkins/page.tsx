import type { Metadata } from "next";

import { Card } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { checkinStats, muteRate } from "@/lib/data/checkins";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Check-ins", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 44.1 / C97 — THE MEASUREMENT THE RULING ASKED FOR.
 *
 * > *Ship it with an admin-controlled rate, an opt-out and an overnight quiet window, and measure
 * > the mute rate.*
 *
 * ## 🔴 SIX INTEGERS AND NOT ONE PERSON'S WORDS
 *
 * `checkinStats` returns counts. There is no list of replies here and there is none anywhere: a
 * screen showing what patients wrote in answer to an unprompted message would be read by somebody
 * with no clinical relationship to them, about a message they did not ask for. A worrying reply
 * already reaches the one person who should see it, through the crisis path.
 *
 * The sentence saying so is ON the screen (`acheckin.noBodies`), because an absence nobody states
 * reads as a feature somebody has not built yet.
 *
 * ## 🔴 AND THE RATE IS SHOWN BESIDE THE THRESHOLD THAT HALTS IT
 *
 * A measurement nobody can act on within a day is a chart. The numbers next to it are settings, so
 * an operator who reads a bad rate can lower the cadence the same afternoon without a deploy.
 */
export default async function AdminCheckinsPage() {
  await requireRole("super_admin");
  const { t } = await getI18n();

  const [settings, rate, stats] = await Promise.all([getSettings(), muteRate(), checkinStats()]);

  const halted = rate.rate >= settings.checkins.muteRateHalt;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">{t("acheckin.title")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("acheckin.body")}</p>
      </div>

      {/* 🔴 The number the ruling named, and the threshold it is measured against. */}
      <Card className={halted ? "border-red-200 bg-red-50 p-5" : "p-5"}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t("acheckin.rate")}
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          {Math.round(rate.rate * 100)}%
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {t("acheckin.rateBody", {
            muted: rate.muted,
            reachable: rate.reachable,
            halt: `${Math.round(settings.checkins.muteRateHalt * 100)}%`,
          })}
        </p>
        {halted ? (
          <p className="mt-2 text-sm font-semibold text-red-700">{t("acheckin.halted")}</p>
        ) : null}
      </Card>

      <Card className="p-5">
        <ul className="space-y-1 text-sm text-slate-700">
          <li>{t("acheckin.sent", { count: stats.sent })}</li>
          <li>{t("acheckin.delivered", { count: stats.delivered })}</li>
          <li>{t("acheckin.replies", { count: stats.replies })}</li>
          <li>{t("acheckin.crisisRouted", { count: stats.crisisRouted })}</li>
          <li>{t("acheckin.mutedCount", { count: stats.muted })}</li>
          <li>{t("acheckin.unmutedCount", { count: stats.unmuted })}</li>
        </ul>
      </Card>

      {/* 🔴 The absence, stated. An unstated absence reads as an unbuilt feature. */}
      <p className="text-xs leading-relaxed text-slate-500">{t("acheckin.noBodies")}</p>
    </div>
  );
}
