import { AlertTriangle, Clock, FileText, MessageSquare } from "lucide-react";

import { Badge, Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";

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
export function StandingProfile({
  profile,
  timeline,
  stale,
}: {
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
  if (!profile || profile.sections.length === 0) {
    return (
      <Card className="px-4 py-6">
        <p className="text-sm font-semibold text-slate-900">Standing profile</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Built automatically from sessions and documents after each one. There is nothing to build
          from yet.
        </p>
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
                The sessions and the history disagree
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                Both are shown as they were recorded. Which one is right is yours to decide — we do
                not choose.
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
            <p className="text-sm font-semibold text-slate-900">Standing profile</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Rebuilt {formatDate(profile.generatedAt)} from {profile.sessionCount} session
              {profile.sessionCount === 1 ? "" : "s"} and {profile.documentCount} document
              {profile.documentCount === 1 ? "" : "s"}. Not editable — it follows the record.
            </p>
          </div>
          {stale ? <Badge tone="amber">Behind the record</Badge> : null}
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
            <p className="text-sm font-semibold text-slate-900">Timeline</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Dated by when things happened, not when they were written down.
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
                    {formatDate(entry.observedAt)}
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
