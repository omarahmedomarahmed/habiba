"use client";

import { useState, useTransition } from "react";

import { completeApproval, declineApproval } from "@/app/(admin)/admin/approval-actions";
import { Button, Card } from "@/components/ui";
import { effectSentence, type EffectRow } from "@/lib/billing/adjust-effect";
import { useT } from "@/lib/i18n/client";

export type PendingApprovalView = {
  id: string;
  kind: "transfer_without_proof" | "ledger_adjustment" | "owner_invite";
  /** What the act is, in one line, built on the server. */
  what: string;
  reason: string;
  askedByName: string;
  mine: boolean;
  /**
   * 🔴 Board 593: a hand adjustment's balances before and after, with whose
   * they are, so the second person reads the effect rather than a code.
   */
  adjustment?: { effect: EffectRow[]; clinician: string | null; org: string | null } | null;
};

/**
 * 🔴 0161 / ruling 13c — what a first person asked and a second completes.
 * Hidden when empty, so a queue with nothing waiting shows nothing.
 *
 * 🔴 Board 593: Complete revalidates the page, the row leaves the list, and
 * its answer used to leave with it, so the second person saw nothing happen.
 * What was just decided now stays on the card until the page is left.
 */
export function PendingApprovals({ rows }: { rows: PendingApprovalView[] }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [decided, setDecided] = useState<{ id: string; note: string }[]>([]);
  const open = rows.filter((row) => !decided.some((d) => d.id === row.id));
  if (open.length === 0 && decided.length === 0) return null;

  const title = (row: PendingApprovalView) =>
    t(
      row.kind === "ledger_adjustment"
        ? "appr.ledger"
        : row.kind === "owner_invite"
          ? "appr.owner"
          : "appr.transfer",
    );

  return (
    <Card className="mb-6 p-4">
      <h2 className="text-sm font-semibold">{t("appr.title")}</h2>
      {decided.length > 0 ? (
        <div className="mt-3 rounded-xl bg-brand-50 p-3 ring-1 ring-brand-100" role="status">
          <ul className="space-y-1">
            {decided.map((d) => (
              <li key={d.id} className="text-sm text-brand-800">
                {d.note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className="mt-3 divide-y divide-slate-100">
        {open.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 text-sm">
              {row.adjustment ? (
                <p className="font-medium">
                  {title(row)}: {effectSentence(t, row.adjustment.effect, row.adjustment)}
                </p>
              ) : (
                <p className="font-medium">
                  {title(row)}: {row.what}
                </p>
              )}
              <p className="text-slate-600">{row.reason}</p>
              <p className="text-xs text-slate-500">{t("appr.askedBy", { name: row.askedByName })}</p>
              {notes[row.id] ? <p className="mt-1 text-xs text-red-700">{notes[row.id]}</p> : null}
            </div>
            {row.mine ? (
              <p className="text-xs text-slate-500">{t("appr.yours")}</p>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await completeApproval(row.id);
                      if (result.error) {
                        setNotes((n) => ({ ...n, [row.id]: result.error ?? "" }));
                        return;
                      }
                      const note =
                        result.effect && row.adjustment
                          ? t("adj.posted", { effect: effectSentence(t, result.effect, row.adjustment) })
                          : `${title(row)}: ${result.ok ?? ""}`;
                      setDecided((d) => [...d, { id: row.id, note }]);
                    })
                  }
                >
                  {t("appr.complete")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await declineApproval(row.id);
                      if (result.error) {
                        setNotes((n) => ({ ...n, [row.id]: result.error ?? "" }));
                        return;
                      }
                      setDecided((d) => [...d, { id: row.id, note: `${title(row)}: ${result.ok ?? ""}` }]);
                    })
                  }
                >
                  {t("appr.decline")}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
