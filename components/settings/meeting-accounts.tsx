"use client";

import { useState, useTransition } from "react";

import {
  disconnectMeetingAccount,
  type IntegrationState,
} from "@/app/(app)/settings/integrations/actions";
import { Card } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";

/**
 * The meeting accounts panel. PLAN.md 41.3.
 *
 * ## 🔴 There is no input in this component, by construction
 *
 * Connecting is an `<a>` to an OAuth redirect. Disconnecting is a button. A
 * clinician is never asked to paste a key, never shown one, and there is no
 * prop on this component that could carry one — `connections` holds a
 * provider, a label and a date.
 *
 * `verify:sprint41` asserts the absence of `<input` and `<textarea` in this
 * file, the same way 51.6 asserts it of the source panel, because "we would
 * never add a key field" is a promise and a scan is a fact.
 *
 * ## The warning, which is the whole reason this panel has prose
 *
 * Each provider says what might stop it working before anybody tries, and the
 * page says the 24Therapy room already works regardless. A clinician who
 * cannot connect has lost nothing, and should find that out here rather than
 * after a round trip through an IT policy nobody here can change.
 */

export function MeetingAccounts({
  available,
  providers,
  connections,
}: {
  /** `features.meetingBots` — both the bot key and the sealing key. */
  available: boolean;
  providers: { provider: string; name: string; mayBeBlocked: string }[];
  connections: { provider: string; accountLabel: string | null; connectedAt: string }[];
}) {
  const t = useT();
  const [state, setState] = useState<IntegrationState>({});
  const [pending, startTransition] = useTransition();

  const disconnect = (provider: string) =>
    startTransition(async () => {
      setState({});
      setState(await disconnectMeetingAccount(provider));
    });

  const connected = new Map(connections.map((c) => [c.provider, c]));

  /*
   * 🔴 Nothing offered that cannot be honoured.
   *
   * With no Recall key, or no key to seal a refresh token with, a Connect
   * button leads to a callback that would refuse. Saying so is the same rule
   * `lib/integrations/registry.ts` applies to the marketing site, arriving
   * through the portal instead.
   */
  if (!available) {
    return (
      <Card className="p-5">
        <p className="text-sm text-navy-400">{t("portal.meet.unavailable")}</p>
        <p className="mt-2 text-sm leading-relaxed text-navy-400">
          {t("portal.meet.fallback")}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {connections.length === 0 ? (
        <p className="text-sm leading-relaxed text-navy-400">{t("portal.meet.none")}</p>
      ) : null}

      {providers.map((spec) => {
        const live = connected.get(spec.provider);

        return (
          <Card key={spec.provider} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy-700">{spec.name}</p>
                {live ? (
                  <>
                    <p className="mt-0.5 text-sm text-navy-400">
                      {live.accountLabel
                        ? t("portal.meet.connected", { account: live.accountLabel })
                        : t("portal.meet.connectedOn", { date: live.connectedAt })}
                    </p>
                  </>
                ) : (
                  <>
                    {/*
                      🔴 41.3 — before they try, not after.
                      Each provider's reason differs, so each says its own.
                    */}
                    <p className="mt-1.5 text-xs font-semibold tracking-wide text-navy-400 uppercase">
                      {t("portal.meet.mayBlock")}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-navy-400">
                      {spec.mayBeBlocked}
                    </p>
                  </>
                )}
              </div>

              {live ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => disconnect(spec.provider)}
                  className="tap-target h-10 shrink-0 rounded-xl bg-navy-50 px-3 text-sm font-semibold text-navy-600 hover:bg-navy-100 disabled:opacity-50"
                >
                  {t("portal.meet.disconnect")}
                </button>
              ) : (
                /*
                  A link, not a form. OAuth is a redirect, and a redirect is the
                  only shape of "connect" that never has a field in it.
                */
                <a
                  href={`/api/meetings/connect/${spec.provider}`}
                  className="tap-target flex h-10 shrink-0 items-center rounded-xl bg-navy-600 px-3 text-sm font-semibold text-white"
                >
                  {t("portal.meet.connect", { name: spec.name })}
                </a>
              )}
            </div>
          </Card>
        );
      })}

      <p className="text-sm leading-relaxed text-navy-400">{t("portal.meet.fallback")}</p>

      {/*
        🔴 41.1 / C132, said on the screen where somebody would wonder what we
        can see once they connect.
      */}
      <p className="text-xs leading-relaxed text-navy-400">
        {t("portal.meet.neverCalendar")}
      </p>

      {state.error ? (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
