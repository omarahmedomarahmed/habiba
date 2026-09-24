"use client";

import { useState, useTransition } from "react";

import { useT } from "@/lib/i18n/client";

/**
 * 🔴 W2-S04 — ONE SHAPE FOR EVERY ACT A COMPANY CANNOT TAKE BACK.
 *
 * Replace the code, remove a field, revoke a key: each was one tap, or a second
 * tap with no way back out, and none said it had worked. So each is now the same
 * three steps: the trigger, then the sentence saying what happens with a red
 * button and a Cancel beside it, then a line saying it is done.
 *
 * `act` returns the action's own result, so a refusal is shown rather than read
 * as success.
 */
export function ConfirmAct({
  label,
  body,
  confirmLabel,
  done,
  act,
  className,
}: {
  /** The trigger, and the red button's label unless `confirmLabel` says otherwise. */
  label: string;
  /** What happens, said before the red button rather than after it. */
  body: string;
  confirmLabel?: string;
  /** What is said once it has worked. */
  done: string;
  act: () => Promise<{ error?: string } | { ok: true } | void>;
  className?: string;
}) {
  const t = useT();
  const [stage, setStage] = useState<"idle" | "confirm" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (stage === "done") {
    return (
      <p role="status" className={`text-xs font-semibold text-brand-700 ${className ?? ""}`}>
        {done}
      </p>
    );
  }

  if (stage === "idle") {
    return (
      <button
        type="button"
        onClick={() => setStage("confirm")}
        className={`tap-target h-9 rounded-xl px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 ${className ?? ""}`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <span className="text-xs leading-relaxed text-slate-600">{body}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await act();
            if (result && "error" in result && result.error) {
              setError(result.error);
              return;
            }
            setStage("done");
          })
        }
        className="tap-target h-9 rounded-xl bg-red-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
      >
        {confirmLabel ?? label}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setStage("idle");
        }}
        className="tap-target h-9 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
      >
        {t("sponsor.cancel")}
      </button>
      {error ? (
        <p role="alert" className="w-full text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
