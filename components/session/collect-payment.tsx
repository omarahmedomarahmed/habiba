"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { paidDirectly, sendPayLink } from "@/app/(app)/sessions/[id]/actions";
import { Button, Card } from "@/components/ui";
import { Money } from "@/components/ui/money";
import { useT } from "@/lib/i18n/client";

/**
 * 🔴 PAY BEFORE START, the screen the therapist turns towards the patient.
 * It checks every few seconds; Start appears the moment the payment is in.
 */
export function CollectPayment(props: {
  sessionId: string;
  svg: string;
  url: string;
  priceCents: number;
  paid: boolean;
  patientName: string;
  canSend: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (props.paid) return;
    const every = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(every);
  }, [props.paid, router]);

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <Card className="p-5 text-center">
        <p className="text-sm text-slate-600">{props.patientName}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
          <Money cents={props.priceCents} />
        </p>
        {props.paid ? (
          <>
            <p className="mt-3 text-sm font-semibold text-brand-700">{t("collect.paid")}</p>
            <Link
              href={`/sessions/${props.sessionId}/room`}
              className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-brand-500 text-sm font-semibold text-navy-600"
            >
              {t("collect.start")}
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto mt-4 w-56" dangerouslySetInnerHTML={{ __html: props.svg }} />
            <p className="mt-3 text-sm text-slate-600">{t("collect.scan")}</p>
            <p className="mt-1 text-xs text-slate-400" role="status">
              {t("collect.waiting")}
            </p>
          </>
        )}
      </Card>

      {props.paid ? null : (
        <Card className="space-y-2 p-4">
          {props.canSend ? (
            <Button
              variant="secondary"
              className="w-full"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await sendPayLink(props.sessionId);
                  setNote(result.error ?? t("collect.sent"));
                })
              }
            >
              {t("collect.send")}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            className="w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await paidDirectly(props.sessionId);
                if (result.error) setNote(result.error);
                else router.push(`/sessions/${props.sessionId}/room`);
              })
            }
          >
            {t("collect.direct")}
          </Button>
          {note ? <p className="text-xs text-slate-600">{note}</p> : null}
        </Card>
      )}
    </div>
  );
}
