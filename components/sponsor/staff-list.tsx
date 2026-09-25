"use client";

import { useActionState } from "react";

import { uploadStaffList, type ListState } from "@/app/(sponsor)/sponsor/settings/actions";
import { Button, Card, Field, Textarea } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * 🔴 0162 / ruling 15 — the staff list: a CSV of emails, nothing else. Shows
 * how many are on it and when it last changed, never who.
 */
export function StaffList({ onList, lastUpload, graceDays }: { onList: number; lastUpload: string | null; graceDays: number }) {
  const t = useT();
  const [state, action, pending] = useActionState(uploadStaffList, {} as ListState);
  return (
    <Card className="p-5">
      <p className="text-base font-bold tracking-tight text-slate-900">{t("sponsor.list.title")}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        {t("sponsor.list.body", { days: graceDays })}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        {lastUpload ? t("sponsor.list.count", { count: onList, date: lastUpload }) : t("sponsor.list.none")}
      </p>
      <form action={action} className="mt-3 space-y-3">
        <Field label={t("sponsor.list.file")} htmlFor="list-file">
          <input id="list-file" name="file" type="file" accept=".csv,.txt,text/csv,text/plain" className="text-sm" />
        </Field>
        <Field label={t("sponsor.list.paste")} htmlFor="list-emails">
          <Textarea id="list-emails" name="emails" rows={3} />
        </Field>
        {state.error ? (
          <p role="alert" className="text-xs text-red-600">
            {t(state.error as MessageKey)}
          </p>
        ) : null}
        {state.ok ? (
          <p role="status" className="text-xs text-brand-700">
            {t("sponsor.list.done", { count: state.onList ?? 0, removed: state.removed ?? 0 })}
          </p>
        ) : null}
        <Button size="sm" type="submit" disabled={pending}>
          {t("sponsor.list.upload")}
        </Button>
      </form>
    </Card>
  );
}
