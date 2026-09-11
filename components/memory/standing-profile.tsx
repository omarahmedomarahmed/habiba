import { AlertTriangle, Clock, FileText, MessageSquare } from "lucide-react";

import { Badge, Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/config";

/*
 * 12.3 / C70 — the zone this screen prints its dates in.
 *
 * A **prop**, not `readerZone()`: this renders on the server, where the
 * browser's zone is not available and the server's own is UTC. The page passes
 * `actor.timezone`, so a clinician who has set one in Settings sees their own
 * days and one who has not is shown UTC rather than being quietly told the
 * wrong thing.
 */

/**
 * The standing profile and the dated timeline. PLAN.md 9.1–9.4.
 *
 * A server component: nothing here is interactive, because nothing here is
 * editable. 9.1 — *never hand-edited into permanence* — is a property of the
 * data layer, and the absence of a single input on this screen is what that
 * looks like from the outside.
 *
 * ## Conflicts sit above the profile, not inside it
 *
 * 9.4: *surface conflicts, never resolve.* A contradiction folded into a
 * paragraph is a contradiction the reader will skim past. It gets its own
 * block, amber, above the summary, with both sides quoted — because the
 * clinician is the one who decides which account is true, and they can only do
 * that if they know there is a question.
 */
export async function StandingProfile({
  profile,
  timeline,
  stale,
  zone,
  locale,
}: {
  /** 37L.9 — the reader's language, a prop for the same reason the zone is. */
  locale: Locale;
  /** The reader's own zone. 12.3. */
  zone: string | null;
  profile: {
    sections: { heading: string; body: string; refs: string[] }[];
    conflicts: { text: string; refs: string[] }[];
    sessionCount: number;
    documentCount: number;
    generatedAt: Date;
  } | null;
  timeline: {
    id: string;
    observedAt: Date;
    text: string;
    source: "session" | "document";
    ref: string | null;
  }[];
  stale: boolean;
}) {
  /*
   * 🔴 C199 again, caught by the guard that exists because of it. This is a
   * SERVER component (the page awaits it and hands it a zone and a locale),
   * so `useT()` compiles, type-checks, builds, and 500s at request time.
   * `getI18n()` is the server's translator.
   */
  const { t } = await getI18n();

  if (!profile || profile.sections.length === 0) {
    return (
      <Card className="px-4 py-6">
        <p className="text-sm font-semibold text-slate-900">{t("tsp.title")}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{t("tsp.none")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {profile.conflicts.length > 0 ? (
        <Card className="border border-amber-200 bg-amber-50/50">
          <div className="flex items-start gap-2.5 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                {t("tsp.conflict")}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                {t("tsp.conflictBody")}
              </p>
              <ul className="mt-2 space-y-2">
                {profile.conflicts.map((conflict, i) => (
                  <li key={i} className="text-sm leading-relaxed text-amber-900">
                    {conflict.text}
                    <span className="ms-1.5 font-mono text-xs text-amber-700/70">
                      {conflict.refs.join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{t("tsp.title")}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {t("tsp.rebuilt", {
                date: formatDate(profile.generatedAt, zone, locale),
                sessions:
                  profile.sessionCount === 1
                    ? t("tsp.sessionOne")
                    : t("tsp.sessionMany", { count: profile.sessionCount }),
                documents:
                  profile.documentCount === 1
                    ? t("tsp.documentOne")
                    : t("tsp.documentMany", { count: profile.documentCount }),
              })}
            </p>
          </div>
          {stale ? <Badge tone="amber">{t("tsp.behind")}</Badge> : null}
        </div>

        <div className="divide-y divide-slate-100">
          {profile.sections.map((section) => (
            <section key={section.heading} className="px-4 py-3">
              <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {section.heading}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{section.body}</p>
              {/*
                9.1 — dated and cited. The refs are rendered rather than
                hidden behind a tooltip: a claim you have to hover to check is
                a claim nobody checks.
              */}
              <p className="mt-1.5 font-mono text-xs text-slate-400">{section.refs.join(" · ")}</p>
            </section>
          ))}
        </div>
      </Card>

      {timeline.length > 0 ? (
        <Card>
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{t("tsp.timeline")}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {t("tsp.timelineBody")}
            </p>
          </div>
          <ol className="divide-y divide-slate-100">
            {timeline.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className="mt-0.5 shrink-0 text-slate-400">
                  {entry.source === "session" ? (
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="h-3 w-3" aria-hidden />
                    {formatDate(entry.observedAt, zone, locale)}
                    {entry.ref ? (
                      <span className="font-mono text-slate-400">{entry.ref}</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{entry.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
    </div>
  );
}
