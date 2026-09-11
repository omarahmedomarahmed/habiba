"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  cancelInvite,
  inviteMyTherapist,
  type InviteState,
} from "@/app/(patient)/patient/consent/actions";
import { Button, Card } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/**
 * Inviting a therapist. PLAN.md 27.2, C102b, C107.
 *
 * ## 🔴 What the copy on this card is not allowed to say
 *
 * "Send your record." Nothing is sent. This mints six characters that a
 * clinician can redeem, and redeeming them creates a **request** that comes
 * back to this same person to approve. The word is invite, and the screen says
 * out loud that they will be asked again, because a patient who believes they
 * have already shared everything will not read the approval when it arrives.
 *
 * ## Why a code and not a link
 *
 * A link is tapped by whoever is holding the phone. A code is read out across
 * a desk to a specific person in a specific room, which is a slower and more
 * deliberate act, and deliberateness is the entire defence against the
 * coercion C107 describes.
 */
export function InviteTherapist({
  live,
}: {
  live: {
    id: string;
    code: string;
    expiresOn: string;
    redeemedBy: string | null;
    /** True while that clinician's request is still unanswered. */
    awaitingAnswer?: boolean;
  }[];
}) {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<InviteState>({});
  const [pending, start] = useTransition();

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">{t("consent.newTherapist")}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        {t("consent.newTherapistBody")}
      </p>

      {live.length > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {live.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-3"
            >
              <span>
                <span className="block font-mono text-lg font-bold tracking-[0.2em] text-slate-900">
                  {invite.code}
                </span>
                <span className="block text-xs text-slate-500">
                  {/*
                    🔴 37R.25 — this said "Look for their request above" whether
                    or not a request was still there to look at, so a patient
                    who had already answered was sent hunting for a section
                    that had gone. It now says where things stand.
                  */}
                  {invite.redeemedBy
                    ? invite.awaitingAnswer
                      ? t("consent.usedWaiting", { name: invite.redeemedBy })
                      : t("consent.usedAnswered", { name: invite.redeemedBy })
                    : t("consent.goodUntil", { date: invite.expiresOn })}
                </span>
              </span>
              {invite.redeemedBy ? null : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await cancelInvite(invite.id);
                      router.refresh();
                    })
                  }
                  className="text-sm font-semibold text-slate-500"
                >
                  {t("consent.cancelIt")}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {state.code ? (
        <div className="mt-3 rounded-xl bg-teal-50 px-3.5 py-3">
          <p className="font-mono text-2xl font-bold tracking-[0.2em] text-teal-900">
            {state.code}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-teal-900/80">
            Read it to your therapist. It works until {state.expiresOn}, once, and you will be
            asked to approve before they can read anything.
          </p>
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <Button
        className="mt-3"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await inviteMyTherapist();
            setState(result);
            if (!result.error) router.refresh();
          })
        }
      >
        {pending ? t("common.working") : t("consent.inviteTherapist")}
      </Button>
    </Card>
  );
}
