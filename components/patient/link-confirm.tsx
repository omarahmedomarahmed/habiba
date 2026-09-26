"use client";

import { useState, useTransition } from "react";

import { confirmLink } from "@/app/(patient)/patient/link/[token]/actions";
import { useT } from "@/lib/i18n/client";

/** 🔴 Board 932: the one tap that links a platform's reference to this person. */
export function LinkConfirm({ token }: { token: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await confirmLink(token);
            if (result?.error) setError(t("plink.deadBody"));
          })
        }
        className="flex h-11 w-full items-center justify-center rounded-xl bg-brand-500 text-sm font-semibold text-navy-600 disabled:opacity-40"
      >
        {pending ? t("common.saving") : t("plink.confirm")}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
