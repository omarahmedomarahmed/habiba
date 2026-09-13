"use client";

import { useState, useTransition } from "react";

import { setCheckins } from "@/app/(patient)/patient/messages/actions";
import { Button, Card } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/**
 * 🔴 44.1 — two buttons rather than a toggle, and the reason is who is reading.
 *
 * A toggle asks somebody to work out which state it is currently in and what pressing it would do.
 * Two labelled buttons with the current one marked say both without being read twice, and the person
 * on this screen may be having a bad day: this is the screen somebody reaches when unprompted
 * messages have become too much.
 */
export function CheckinSwitch({ on, mutedOn }: { on: boolean; mutedOn: string | null }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(on);

  const choose = (next: boolean) =>
    startTransition(async () => {
      setCurrent(next);
      await setCheckins(next);
    });

  return (
    <Card className="p-5">
      <div className="flex flex-wrap gap-2">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            type="button"
            disabled={pending}
            onClick={() => choose(value)}
            aria-pressed={current === value}
            className={
              current === value
                ? "tap-target h-11 flex-1 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
                : "tap-target h-11 flex-1 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            }
          >
            {value ? t("checkin.on") : t("checkin.off")}
          </button>
        ))}
      </div>

      {!current && mutedOn ? (
        <p className="mt-3 text-xs text-slate-500">{t("checkin.mutedOn", { date: mutedOn })}</p>
      ) : null}
    </Card>
  );
}
