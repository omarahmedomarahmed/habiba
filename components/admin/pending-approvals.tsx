"use client";

import { useState, useTransition } from "react";

import { completeApproval, declineApproval } from "@/app/(admin)/admin/approval-actions";
import { Button, Card } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

export type PendingApprovalView = {
  id: string;
  kind: "transfer_without_proof" | "ledger_adjustment" | "owner_invite";
  /** What the act is, in one line, built on the server. */
  what: string;
  reason: string;
  askedByName: string;
  mine: boolean;
};

/**
 * 🔴 0161 / ruling 13c — what a first person asked and a second completes.
 * Hidden when empty, so a queue with nothing waiting shows nothing.
 */
export function PendingApprovals({ rows }: { rows: PendingApprovalView[] }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (rows.length === 0) return null;

  return (
    <Card className="mb-6 p-4">
      <h2 className="text-sm font-semibold">{t("appr.title")}</h2>
      <ul className="mt-3 divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                {t(
                  row.kind === "ledger_adjustment"
                    ? "appr.ledger"
                    : row.kind === "owner_invite"
                      ? "appr.owner"
                      : "appr.transfer",
                )}
                : {row.what}
              </p>
              <p className="text-slate-600">{row.reason}</p>
              <p className="text-xs text-slate-500">{t("appr.askedBy", { name: row.askedByName })}</p>
              {notes[row.id] ? <p className="mt-1 text-xs text-brand-700">{notes[row.id]}</p> : null}
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
                      setNotes((n) => ({ ...n, [row.id]: result.error ?? result.ok ?? "" }));
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
                      setNotes((n) => ({ ...n, [row.id]: result.error ?? result.ok ?? "" }));
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
