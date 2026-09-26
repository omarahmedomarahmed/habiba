import Link from "next/link";

import { Badge, Card } from "@/components/ui";
import { countKey } from "@/lib/i18n/count-form";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/server";
import { alertWords, type AlertStatus } from "@/lib/observability/alert-words";
import { formatDateTime } from "@/lib/utils";

type Row = { key: string; sentAt: Date | null; status: AlertStatus };

/** 🔴 Board 423: one alert, as a sentence rather than an internal key. */
export function alertSentence(t: Translate, key: string): string {
  const words = alertWords(key);
  return t(words.key, words.job ? { ...words.values, job: t(words.job) } : words.values);
}

const TONE: Record<AlertStatus, "red" | "green" | "slate"> = { open: "red", cleared: "green", report: "slate" };
const LABEL = { open: "aops.open", cleared: "aops.cleared", report: "aops.report" } as const;

/**
 * 🔴 Board 423: where staff look first. The count of open alerts, the open ones
 * in plain words, and the way to the page with the jobs and the errors.
 */
export function OpsAlertsCard({ rows, t }: { rows: Row[]; t: Translate }) {
  const open = rows.filter((row) => row.status === "open");
  return (
    <Card className={open.length > 0 ? "border-red-200 p-4" : "p-4"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">
          {t("aops.title")}
          {" · "}
          <span className={open.length > 0 ? "text-red-700" : "text-slate-500"}>
            {t(countKey("aops.openCount", open.length), { count: open.length })}
          </span>
        </p>
        <Link href="/admin/errors" className="text-sm font-medium text-brand-700 hover:underline">
          {t("aops.see")}
        </Link>
      </div>
      {open.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">{t("aops.none")}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-slate-800">
          {open.map((row) => (
            <li key={row.key}>{alertSentence(t, row.key)}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Every alert of the week, each marked open, cleared or a report. For /admin/errors. */
export function OpsAlertsList({
  rows,
  t,
  zone,
  locale,
}: {
  rows: Row[];
  t: Translate;
  zone: string | null;
  locale: Locale;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      <p className="text-xs font-semibold text-slate-700">{t("aops.week")}</p>
      <ul className="mt-1 divide-y divide-slate-100 text-sm">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
            <span className="text-slate-800">{alertSentence(t, row.key)}</span>
            <span className="flex items-center gap-2 text-xs text-slate-500">
              {row.sentAt ? formatDateTime(row.sentAt, zone, locale) : null}
              <Badge tone={TONE[row.status]}>{t(LABEL[row.status])}</Badge>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
