"use client";

import { useState, useTransition } from "react";
import { Plug, PlugZap } from "lucide-react";

import { unlinkPlatform } from "@/app/(patient)/patient/consent/actions";
import { Button, Card } from "@/components/ui";

/**
 * Platforms that can identify you here, and the tap that ends it. 55.6, C277.
 *
 * ## 🔴 WHY THIS IS A SEPARATE BLOCK FROM THE CONSENT LIST ABOVE IT
 *
 * They answer different questions and a person conflates them at their cost.
 * The consent list is *who can read my history*, and every row there is a
 * clinician. This is *who can tell you that I am me*, and every row here is a
 * company. Somebody can revoke every grant and still be "P123" to a platform,
 * which is exactly the state that existed for everybody until this screen.
 *
 * ## What a person is shown
 *
 * The platform's name and when the link was made. Not their reference for you:
 * it is their internal id, it means nothing to you, and putting it here turns a
 * consent decision into a puzzle.
 *
 * ## 🔴 NO CONFIRMATION DIALOG
 *
 * Same reasoning the consent list gives about declining: a dialog on the way
 * out is pressure with a polite face. The copy says plainly what ending it
 * does, before the button rather than after it.
 */
export function LinkedPlatforms({
  links,
}: {
  links: { subjectId: string; partnerName: string; linkedLabel: string }[];
}) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * 🔴 Nothing at all when there are none, rather than an empty state.
   *
   * Most people will never have used a partner platform, and a permanent card
   * explaining a connection they do not have teaches them to worry about it.
   */
  if (links.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Plug className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-900">
          Platforms that can identify you
        </h2>
      </div>

      <p className="mt-1.5 text-sm text-slate-600">
        You confirmed to these that an account of theirs is you. Ending one stops
        them asking about you and stops sessions they hold arriving in your
        record here. Nothing already in your record is removed, and no therapist
        loses anything you gave them.
      </p>

      {error ? (
        <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>
      ) : null}

      <ul className="mt-3 divide-y divide-slate-100">
        {links.map((link) => (
          <li
            key={link.subjectId}
            className="flex flex-wrap items-center justify-between gap-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {link.partnerName}
              </p>
              <p className="text-xs text-slate-500">Connected {link.linkedLabel}</p>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="h-8 px-2.5 text-xs"
              disabled={pending && busy === link.subjectId}
              onClick={() => {
                setBusy(link.subjectId);
                setError(null);
                start(async () => {
                  const result = await unlinkPlatform(link.subjectId);
                  if (result.error) setError(result.error);
                  setBusy(null);
                });
              }}
            >
              <PlugZap className="me-1.5 h-3.5 w-3.5" />
              {pending && busy === link.subjectId ? "…" : "End this"}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
