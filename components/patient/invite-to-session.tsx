"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Check, Copy } from "lucide-react";

import { inviteToPaidSession } from "@/app/(app)/patients/actions";
import { Card } from "@/components/clinician/kit";
import { Money } from "@/components/ui/money";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * 🔴 76.40 — ONE TAP FROM A PROFILE TO A BOOKED, PAID SESSION.
 *
 * ## The thing this replaces
 *
 * Nothing. A clinician looking at somebody's profile who wanted to see them
 * again had to leave, open the new-session form, find the same person in a
 * dropdown, set a price, start it, then go and find the join link. Five
 * screens to say "come back on Tuesday".
 *
 * ## Why the price is not an input here
 *
 * It is read on the server from the clinician's own settings and shown back as
 * a fact. A price typed into a profile page is a price nobody agreed on and a
 * second place for the session rate to live; C311 says a price somebody was
 * shown is a price they are owed, and the way to keep that true is to have one
 * source for it. A clinician who wants a different number changes it where it
 * is set.
 *
 * ## 🔴 THE LINK IS SHOWN EVEN WHEN WE SENT IT
 *
 * `notify` reports whether anything actually went out, and §6 says report it
 * rather than assume it. A clinician who believes an invitation arrived and is
 * wrong finds out when nobody turns up. So the link is always on screen to
 * pass on by hand, and the line above it says whether we managed to send it.
 */
export function InviteToSession({
  patientId,
  promiseKey,
}: {
  patientId: string;
  /**
   * 🔴 Board 832: the line before the tap, from `invitePromiseKey` on the
   * server: only the route that will carry the invitation, so a chart with a
   * number and no address is not promised a message WhatsApp cannot send.
   */
  promiseKey: MessageKey;
}) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState<{
    url: string;
    priceCents: number;
    sent: boolean;
    channel: string | null;
  } | null>(null);

  const reachable = promiseKey !== "pinv.needsHandle";

  const invite = () =>
    start(async () => {
      setError(null);
      const result = await inviteToPaidSession(patientId);
      if ("error" in result) setError(result.error);
      else setDone(result);
    });

  const copy = async () => {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* The box below is selectable. A clipboard a browser refuses is not an error. */
    }
  };

  return (
    <Card>
      <div className="border-b border-navy-100/70 px-4 py-3">
        <p className="text-sm font-semibold text-navy-700">{t("pinv.title")}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-navy-400">{t("pinv.blurb")}</p>
      </div>

      <div className="space-y-3 px-4 py-3">
        {done ? (
          <>
            <p className="text-sm text-navy-600">
              {done.sent ? t("pinv.sent") : t("pinv.notSent")}{" "}
              <span className="font-semibold">
                <Money cents={done.priceCents} />
              </span>
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={done.url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-navy-100 bg-navy-50 px-3 py-2 font-mono text-xs text-navy-600"
              />
              <button
                type="button"
                onClick={copy}
                className="tap-target flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-navy-600 px-3 text-sm font-semibold text-white hover:bg-navy-500"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                {copied ? t("common.copied") : t("common.copy")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-navy-400">
              {t(promiseKey)}
            </p>
            <button
              type="button"
              disabled={pending || !reachable}
              onClick={invite}
              className="tap-target flex h-10 items-center gap-1.5 rounded-lg bg-navy-600 px-3 text-sm font-semibold text-white hover:bg-navy-500 disabled:opacity-50"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden />
              {pending ? t("common.working") : t("pinv.cta")}
            </button>
          </>
        )}

        {error ? (
          <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
