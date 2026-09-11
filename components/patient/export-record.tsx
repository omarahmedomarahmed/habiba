"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";

import { exportMyRecord, type ExportState } from "@/app/(patient)/patient/record/actions";
import { Button, Card } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/**
 * "Send me everything." PLAN.md 26.9, 26.10, C128.
 *
 * ## 🔴 The button says what it needs BEFORE it is pressed
 *
 * C128's ruling, and it is a small thing that matters a lot: a person with no
 * email on file must not press "send me my record", wait, and then be told it
 * cannot be done. So when there is no address the button itself says so and
 * goes to the place that fixes it. Most patients here have no email (§3b), so
 * this is the common path rather than the edge case.
 */
export function ExportRecord({ email }: { email: string | null }) {
  const t = useT();
  const [state, setState] = useState<ExportState>({});
  const [pending, start] = useTransition();

  if (!email) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">{t("pexport.title")}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          {t("precord.copyBody")}
        </p>
        <Link
          href="/patient/account"
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white"
        >
          <Mail className="h-4 w-4" aria-hidden />
          {t("precord.addEmail")}
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-slate-900">{t("pexport.title")}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        {t("pexport.body", { email })}
      </p>

      {state.sentTo ? (
        <div className="mt-4 rounded-xl bg-teal-50 px-3.5 py-3">
          <p className="text-sm leading-relaxed text-teal-900">
            {t("pexport.onItsWay", { email: state.sentTo })}
          </p>
          {state.code ? (
            <p className="mt-1.5 text-xs leading-relaxed text-teal-900/80">
              The cover page carries the code {state.code}. Anybody you hand the document to can
              check that code and confirm we produced it.
            </p>
          ) : null}
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <Button
        className="mt-4"
        full
        disabled={pending || Boolean(state.sentTo)}
        onClick={() => start(async () => setState(await exportMyRecord()))}
      >
        {pending ? t("pexport.preparing") : state.sentTo ? t("pexport.sent") : t("pexport.button")}
      </Button>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        {t("pexport.notCertificate")}
      </p>
    </Card>
  );
}
