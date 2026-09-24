"use client";

import { useState, useTransition } from "react";

import { abandonSession } from "@/app/(app)/sessions/actions";
import { Button, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/**
 * 🔴 58.1 — cancel a session, which the pricing page already promised.
 *
 * ## The defect, in the founder's own words
 *
 * The published billing FAQ says, and has said for months:
 *
 *   > **What if a session was a mistake?** Cancel it instead of completing it
 *   > and nothing is charged.
 *
 * `abandonSession` is the function behind that sentence. It cancels the
 * session, releases the radar claim and bills nothing. **No screen called it.**
 * The only thing a clinician could do with a session started by mistake was
 * complete it, which bills them for it.
 *
 * So the claim was false, and it was false in the one direction that costs the
 * reader money. `verify:claims` could not see it, because the sentence is true
 * of the code and false of the product. `verify:reachable` found it on its
 * first run, which is the argument for both gates existing.
 *
 * ## Two clicks, and no dialog
 *
 * Cancelling is irreversible and free, which is an unusual pair. A confirm
 * dialog for a free action reads as ceremony; no confirmation at all on an
 * irreversible one is a trap. So the button arms itself: the first click
 * changes it into the real one and says what will happen, and clicking
 * anywhere else disarms it.
 */
export function CancelSession({ sessionId }: { sessionId: string }) {
  const [armed, setArmed] = useState(false);
  /* 🔴 W1-13: the patient is told why, so the second click needs a reason. */
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = useT();

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-sm font-semibold text-slate-500 underline-offset-2 hover:underline"
      >
        {t("portal.session.cancel")}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-slate-600">{t("portal.session.cancelConfirm")}</p>
      <Input
        aria-label={t("tcancel.reason")}
        placeholder={t("tcancel.reason")}
        value={reason}
        maxLength={300}
        onChange={(event) => setReason(event.target.value)}
      />
      {error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {error}
        </p>
      ) : null}
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await abandonSession(sessionId, reason);
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? t("common.saving") : t("portal.session.cancelYes")}
      </Button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="text-sm font-semibold text-slate-500"
      >
        {t("common.back")}
      </button>
    </div>
  );
}
