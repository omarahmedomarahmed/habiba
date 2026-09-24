"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui";
import { MIN_REASON } from "@/lib/admin/reason";
import { useT } from "@/lib/i18n/client";

/**
 * 🔴 W2-A05: a destructive or customer-visible act is two presses and a reason.
 *
 * The first press opens the reason; the second is enabled at `MIN_REASON`,
 * the same number the server action checks, so a reason the screen accepts is
 * a reason the server accepts. What the action returns is said here, so a
 * failure is never shown as success.
 */
export function ConfirmWithReason({
  label,
  onConfirm,
  variant = "secondary",
  disabled,
  startOpen = false,
  onCancel,
}: {
  label: React.ReactNode;
  onConfirm: (reason: string) => Promise<{ error?: string } | void>;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  /** When the first press happened somewhere else (a chip in a list), open at the reason. */
  startOpen?: boolean;
  onCancel?: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(startOpen);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button type="button" size="sm" variant={variant} disabled={disabled || pending} onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder={t("aconfirm.why")}
        aria-label={t("aconfirm.why")}
        className="h-9 w-64 rounded-lg border border-slate-200 px-2 text-xs"
        autoFocus
      />
      <Button
        type="button"
        size="sm"
        variant={variant === "secondary" ? "primary" : variant}
        disabled={pending || reason.trim().length < MIN_REASON}
        onClick={() =>
          start(async () => {
            const result = await onConfirm(reason);
            if (result && result.error) setError(result.error);
            else {
              setError(null);
              setOpen(false);
              setReason("");
              onCancel?.();
            }
          })
        }
      >
        {label}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          setOpen(false);
          onCancel?.();
        }}
      >
        {t("common.cancel")}
      </Button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </span>
  );
}
