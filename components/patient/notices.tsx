"use client";

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";

import { dismiss } from "@/app/(patient)/patient/notices/actions";
import { Card } from "@/components/patient/kit";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * What has happened to your benefit. PLAN.md 53.20, C231, C234.
 *
 * ## 🔴 Two lists, and the dismissed one is still here
 *
 * Undismissed notices sit at the top. Dismissed ones fall under "Earlier",
 * quieter but present, and the sentence saying so is on the screen rather than
 * in a help page — because the reason to dismiss is usually "I have read this",
 * and a person who believed dismissal deleted the record of their benefit ending
 * would hesitate over a button that costs nothing.
 *
 * ## 🔴 Every word comes from a key, including the notice body
 *
 * The row holds a `MessageKey`, never a sentence, so `t` resolves it through the
 * admin override, then the shipped language, then English. A notice written in
 * March reads in Arabic in April if the person switches their language, and an
 * admin rewording "your benefit has ended" changes it everywhere at once,
 * including on notices already sent.
 *
 * ## 🔴 No employer is named on this screen because none reaches it
 *
 * That is enforced one layer down: the table has no `sponsor_id` and the query
 * selects four columns. This component could not name an employer if it tried,
 * which is the difference between a rule and a habit.
 */

export type NoticeView = {
  id: string;
  messageKey: MessageKey;
  /** W1-28b: the clinician's reason, on a cancellation. */
  reason?: string | null;
  when: string;
  dismissed: boolean;
};

export function PatientNotices({ notices }: { notices: NoticeView[] }) {
  const t = useT();
  const [pending, startTransition] = useTransition();

  /*
   * Optimistically hidden, so the tap feels immediate on a slow connection. The
   * server is the truth; this only moves the row into the lower list before the
   * revalidation lands.
   */
  const [justDismissed, setJustDismissed] = useState<string[]>([]);

  const hide = (id: string) =>
    startTransition(async () => {
      setJustDismissed((current) => [...current, id]);
      await dismiss(id);
    });

  const isDismissed = (notice: NoticeView) =>
    notice.dismissed || justDismissed.includes(notice.id);

  const current = notices.filter((notice) => !isDismissed(notice));
  const earlier = notices.filter(isDismissed);

  if (notices.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm leading-relaxed text-navy-400">{t("pnotice.none")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {current.length > 0 ? (
        <div className="space-y-2.5">
          {current.map((notice) => (
            <Card key={notice.id} className="flex gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-600 text-brand-300">
                <Bell className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-relaxed font-semibold text-navy-700">{t(notice.messageKey)}</p>
              {notice.reason ? (
                <p className="mt-1 text-sm leading-relaxed text-navy-400">
                  {t("w1a.cancelReasonGiven", { reason: notice.reason })}
                </p>
              ) : null}
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-xs text-navy-400">{notice.when}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => hide(notice.id)}
                  className="tap-target h-9 rounded-full bg-navy-50 px-3.5 text-xs font-semibold text-navy-600 hover:bg-navy-100 disabled:opacity-50"
                >
                  {t("pnotice.dismiss")}
                </button>
              </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-navy-400">{t("pnotice.none")}</p>
        </Card>
      )}

      {/* 🔴 Dismissed, not deleted, and said where the dismissing happens. */}
      <p className="text-xs leading-relaxed text-navy-400">{t("pnotice.keptBody")}</p>

      {earlier.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-navy-400">
            {t("pnotice.earlier")}
          </h2>
          {earlier.map((notice) => (
            <Card key={notice.id} className="p-4 opacity-70">
              <p className="text-sm leading-relaxed text-navy-600">{t(notice.messageKey)}</p>
              {notice.reason ? (
                <p className="mt-1 text-sm leading-relaxed text-navy-400">
                  {t("w1a.cancelReasonGiven", { reason: notice.reason })}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-navy-400">{notice.when}</p>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
