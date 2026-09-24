import "server-only";

import { notify, reachable } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { log } from "@/lib/logger";
import { stringsFor } from "@/lib/i18n/strings";
import {
  candidates,
  muteRate,
  recordCheckin,
} from "@/lib/data/checkins";

import { shouldSend, type Skip } from "./policy";
import { WORDING_KEYS, nextWording, type WordingKey } from "./wording";

/**
 * 🔴 44.1 / C97 — THE SWEEP THAT SENDS THEM. Called from the cron, beside the other sweeps.
 *
 * ## 🔴 IT REPORTS WHY IT DID NOT SEND, BY REASON, AND THAT IS THE POINT
 *
 * The founder's ruling was to *measure the mute rate*, and a sweep that returned only a count of
 * sends would leave the interesting number invisible: how many people it skipped because it was
 * their night, how many because they had muted, how many because the channel is halted. Those are
 * the numbers that say whether the cadence is right, and a cron that logged "sent 4" would hide all
 * of them.
 *
 * ## 🔴 NO MODEL IS CALLED ANYWHERE IN THIS FILE
 *
 * 44.2: *a check-in asks, it never interprets.* The wording comes from twelve admin-editable strings
 * and the choice between them is arithmetic. A generated sentence could not be reviewed before it
 * arrived, and a model asked to be warm about somebody it was given the name of has no way to be
 * sure it is not also being perceptive — which about somebody in distress is interpretation whether
 * or not it was asked for.
 */

export type SweepResult = {
  sent: number;
  skipped: Record<Skip, number>;
  muteRate: number;
};

export async function sweepCheckins(limit = 200): Promise<SweepResult> {
  const settings = await getSettings();
  const rate = await muteRate(settings.checkins.measuredSince);

  const skipped: Record<Skip, number> = {
    channel_off: 0,
    mute_rate_halt: 0,
    muted: 0,
    quiet_hours: 0,
    too_soon: 0,
    unreachable: 0,
  };

  /*
   * 🔴 The halt is evaluated ONCE, before any candidate is read, and it short-circuits.
   *
   * `shouldSend` checks it per person too, because it is a pure function that must be correct on its
   * own. Doing it here as well means a halted channel does not read five hundred rows and compute
   * five hundred timezones to reach the same answer.
   */
  if (!settings.checkins.enabled) {
    return { sent: 0, skipped: { ...skipped, channel_off: 1 }, muteRate: rate.rate };
  }

  if (rate.rate >= settings.checkins.muteRateHalt) {
    /*
     * 🔴 Logged at WARN, because this is the channel telling somebody it was wrong.
     *
     * *A person who mutes it is worse off than one who was messaged less.* Crossing this threshold
     * means enough people have said so that continuing would be choosing to be wrong at everybody,
     * and it must be loud rather than a quiet zero in a cron's return value.
     */
    log.warn("check-ins halted: too many people have muted", {
      muted: rate.muted,
      reachable: rate.reachable,
      halt: settings.checkins.muteRateHalt,
    });
    return { sent: 0, skipped: { ...skipped, mute_rate_halt: 1 }, muteRate: rate.rate };
  }

  const people = await candidates(limit);
  const now = new Date();
  let sent = 0;

  for (const person of people) {
    const decision = shouldSend({
      settings: settings.checkins,
      muteRate: rate.rate,
      muted: person.muted,
      timezone: person.timezone,
      lastSentAt: person.lastSentAt,
      reachable: reachable({ email: person.email, phone: person.phone }),
      now,
    });

    if (!decision.send) {
      skipped[decision.because] += 1;
      continue;
    }

    /*
     * 🔴 The wording, read through `stringsFor` so an ADMIN EDIT applies.
     *
     * Sprint 45's whole point: every string is an overridable `MessageKey`. A check-in assembled
     * from a hard-coded sentence would be the one message in the product an admin could not reword,
     * and it is the message most likely to need rewording — it is the one that arrives unprompted.
     */
    const { t } = await stringsFor(person.locale as "en" | "ar");

    /*
     * 🔴 `{name}` is interpolated by `t` rather than by a `replace` here.
     *
     * The i18n layer already does placeholder substitution, and doing it again by hand would be a
     * second implementation that drifts: an Arabic wording that positioned the name differently
     * would work through `t` and break through a hard-coded replace on the English shape.
     */
    const rendered = Object.fromEntries(
      WORDING_KEYS.map((key) => [key, t(key, { name: person.firstName })]),
    ) as Record<WordingKey, string>;

    const key = nextWording(person.lastBody, rendered);
    /* 🔴 The opt-out travels WITH the message, so it is reachable without finding a screen. */
    const body = `${rendered[key]}\n\n${t("checkin.howToStop")}`;

    const delivery = await notify(
      {
        email: person.email,
        phone: person.phone,
        timezone: person.timezone,
      },
      {
        kind: "checkin.asking",
        subject: t("checkin.subject"),
        body,
      },
    );

    /*
     * 🔴 Recorded whether or not it was delivered, with which.
     *
     * A send that failed is not a check-in they received, so `delivered` is false and the cadence
     * clock still advances. That is deliberate: retrying a failed check-in on the next sweep would
     * turn one bad provider hour into a burst of messages, which is the cadence harm arriving by
     * accident rather than by policy.
     */
    await recordCheckin({
      personId: person.personId,
      channel: delivery.channel ?? "email",
      body,
      locale: person.locale,
      delivered: delivery.sent,
    });

    if (delivery.sent) sent += 1;
  }

  if (sent > 0 || Object.values(skipped).some((n) => n > 0)) {
    log.info("check-ins swept", { sent, ...skipped });
  }

  return { sent, skipped, muteRate: rate.rate };
}
