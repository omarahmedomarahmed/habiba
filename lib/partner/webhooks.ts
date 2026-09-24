import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { and, eq, isNull, lte, sql } from "drizzle-orm";

import { encryptSecret, decryptSecret, secretsConfigured } from "@/lib/crypto/secretbox";
import { controlDb } from "@/lib/db";
import { qualified } from "@/lib/db/qualified";
import {
  organizations,
  partnerSubjects,
  partnerWebhookDeliveries,
  partnerWebhooks,
  users,
  WEBHOOK_TEST_EVENT,
  type WebhookEvent,
} from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";

import { retryWaitMinutes } from "./retry";

/**
 * 🔴 42.4 / 55.10 — A WEBHOOK CARRIES AN EVENT AND AN ID, NEVER CONTENT.
 *
 * > *A leaked webhook URL then leaks nothing.*
 *
 * That is the whole module. The body this sends is three fields, and there is no argument
 * to any function here that could add a fourth: an event name, an opaque uuid, and when
 * it happened. A partner receiving one knows something happened and has to ask, with a
 * key we can revoke, to learn what.
 *
 * ## 🔴 The temptation, stated so it stays refused
 *
 * Every webhook API in the world ships the object with the event, because it saves the
 * receiver a round trip. Here that object is a session, a note or a grant: clinical
 * content, sent to a URL that lives in a partner's configuration, retried on failure,
 * logged by whatever proxy is in front of them, and readable by anybody who ever obtains
 * the URL. The round trip is the security model.
 *
 * ## 🔴 SIGNED, and with the secret SEALED rather than hashed
 *
 * `lib/crypto/secretbox.ts` is the only reversible primitive in the product and this is
 * one of the two places it belongs: signing a delivery needs the secret back, and a hash
 * cannot give it. The signature is over the timestamp AND the body, so a captured
 * delivery cannot be replayed with a new time.
 */

export type NewWebhook = { id: string; secret: string };

/**
 * Register an endpoint. The secret is returned once and sealed at rest.
 *
 * 🔴 HTTPS is enforced by a database CHECK as well as here, because an `http://` endpoint
 * is a signed delivery readable by anybody on the path, and an operator setting one up on
 * a Friday should not be able to.
 */
export async function registerWebhook(input: {
  partnerId: string;
  url: string;
  events: WebhookEvent[];
}): Promise<{ webhook?: NewWebhook; error?: string }> {
  const url = input.url.trim();
  if (!url.startsWith("https://")) return { error: "The endpoint has to be https." };
  if (input.events.length === 0) return { error: "Choose at least one event." };

  if (!secretsConfigured()) {
    /*
     * 🔴 Refused rather than stored in clear. `secretbox` fails closed with no key, and
     * the alternative here would be a webhook whose secret is a plaintext column, which
     * is worse than no webhook.
     */
    return { error: "Webhook signing is not configured on this deployment." };
  }

  const secret = `whsec_${randomBytes(24).toString("base64url")}`;

  const [created] = await controlDb
    .insert(partnerWebhooks)
    .values({
      partnerId: input.partnerId,
      url,
      secretSealed: encryptSecret(secret),
      events: input.events,
    })
    .returning({ id: partnerWebhooks.id });

  if (!created) return { error: "That endpoint could not be saved." };

  return { webhook: { id: created.id, secret } };
}

/**
 * 🔴 Queue a delivery. THE ARGUMENTS ARE THE WHOLE PAYLOAD.
 *
 * An event and a subject id. There is no `payload`, no `data`, no `body` and no
 * `metadata` parameter, and the row has nowhere to put one: 42.4 is enforced by the
 * signature of this function rather than by a reviewer noticing.
 *
 * Queued rather than sent, so a slow or dead endpoint cannot hold up the thing that
 * happened. The cron drains it.
 */
export async function queueWebhook(input: {
  partnerId: string;
  event: WebhookEvent;
  subjectId: string | null;
}): Promise<{ queued: number }> {
  const hooks = await controlDb
    .select({ id: partnerWebhooks.id, events: partnerWebhooks.events })
    .from(partnerWebhooks)
    .where(
      and(eq(partnerWebhooks.partnerId, input.partnerId), isNull(partnerWebhooks.disabledAt)),
    );

  const subscribed = hooks.filter((hook) => hook.events.includes(input.event));
  if (subscribed.length === 0) return { queued: 0 };

  await controlDb.insert(partnerWebhookDeliveries).values(
    subscribed.map((hook) => ({
      webhookId: hook.id,
      event: input.event,
      subjectId: input.subjectId,
    })),
  );

  return { queued: subscribed.length };
}

/**
 * 🔴 THE TWO EVENTS THAT EXISTED AND WERE NEVER SENT.
 *
 * `WEBHOOK_EVENTS` has carried `grant.revoked` and `record.claimed` since 42.4, the
 * CHECK in 0075 lists them, a partner can subscribe to them on their own screen, and
 * `verify:sprint55` has a green check reading *"grant.revoked and record.claimed are
 * webhook events, so a partner is TOLD"*.
 *
 * Nothing ever emitted one. `queueWebhook` had no caller in the product at all, which
 * is why `verify:reachable` named it in `MUST_WIRE`. The check above is the §6 family
 * again: it measured the enum and reported on the delivery.
 *
 * That matters more than an unsent message. C277's promise to a patient is that a
 * partner's access is revocable and that they can claim their record and leave. The
 * mechanism that tells the partner their access just changed did not run, so the
 * partner's own copy of who may read what could drift for as long as they kept it.
 *
 * ## 🔴 WHO HEARS ABOUT A REVOKED GRANT, AND WHY IT IS NOT EVERYBODY
 *
 * Only the partner whose OWN clinician lost the grant. The same scope `whoMayRead`
 * was fixed to carry, for the same reason: a partner learning that this person
 * revoked access to somebody is a partner learning that somebody else was treating
 * them. The payload is an event and a subject id, and even that is one fact too many
 * when the grant was nothing to do with them.
 */
export async function notifyGrantRevoked(input: {
  personId: string;
  therapistUserId: string;
}): Promise<{ queued: number }> {
  const rows = await controlDb
    .select({
      partnerId: organizations.partnerId,
      subjectId: partnerSubjects.id,
    })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .innerJoin(
      partnerSubjects,
      and(
        eq(partnerSubjects.partnerId, organizations.partnerId),
        eq(partnerSubjects.personId, input.personId),
      ),
    )
    .where(
      and(
        eq(users.id, input.therapistUserId),
        /* 🔴 The one definition of "this partner's clinician", third use. */
        eq(organizations.billingMode, "partner_billed"),
        /* A link the person already cut hears nothing more. */
        isNull(partnerSubjects.revokedAt),
      ),
    );

  let queued = 0;
  for (const row of rows) {
    if (!row.partnerId) continue;
    const result = await queueWebhook({
      partnerId: row.partnerId,
      event: "grant.revoked",
      subjectId: row.subjectId,
    });
    queued += result.queued;
  }

  return { queued };
}

/**
 * 🔴 The record was claimed, and every platform holding a live link is told.
 *
 * Broader than the one above, deliberately. A claim changes this person's standing
 * with US: from here they hold their own record and every access to it is theirs to
 * end. A partner with a confirmed link to them is entitled to know that, and it
 * discloses nothing about anybody else, which is what made the revocation case narrow.
 */
export async function notifyRecordClaimed(personId: string): Promise<{ queued: number }> {
  const subjects = await controlDb
    .select({ partnerId: partnerSubjects.partnerId, subjectId: partnerSubjects.id })
    .from(partnerSubjects)
    .where(and(eq(partnerSubjects.personId, personId), isNull(partnerSubjects.revokedAt)));

  let queued = 0;
  for (const subject of subjects) {
    const result = await queueWebhook({
      partnerId: subject.partnerId,
      event: "record.claimed",
      subjectId: subject.subjectId,
    });
    queued += result.queued;
  }

  return { queued };
}

type Outcome = { ok: boolean; status: number | null; error: string | null };

/**
 * 🔴 ONE TRY AT ONE DELIVERY, and the only place a webhook is sent.
 *
 * THE BODY IS BUILT HERE AND IT IS THREE FIELDS. Not assembled from a row, not spread
 * from an object a caller passed: written out, so a future edit that wanted to add
 * content would have to add it to this literal in a diff somebody reads.
 *
 * W2-X03: the drain, a redelivery and a test event all come through here, so the three
 * cannot sign or shape a delivery differently. `x-24t-delivery` is the same on every
 * try of one delivery, so a receiver can drop a repeat (the Standard Webhooks id).
 */
async function attempt(delivery: {
  id: string;
  event: string;
  subjectId: string | null;
  url: string;
  secretSealed: string;
}): Promise<Outcome> {
  const body = JSON.stringify({
    event: delivery.event,
    id: delivery.subjectId,
    at: new Date().toISOString(),
  });

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const secret = decryptSecret(delivery.secretSealed);
    /*
     * 🔴 Signed over the TIMESTAMP and the body together.
     *
     * Signing the body alone makes a captured delivery replayable for ever; the
     * receiver checks the timestamp is recent and the signature covers it, which is the
     * construction Stripe uses and for the same reason.
     */
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    const response = await fetch(delivery.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-24t-signature": `t=${timestamp},v1=${signature}`,
        "x-24t-delivery": delivery.id,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    return { ok: response.ok, status: response.status, error: null };
  } catch (error) {
    return { ok: false, status: null, error: safeErrorMessage(error).slice(0, 300) };
  }
}

/** Minutes from the DATABASE's now, so the drain and the schedule share one clock. */
const inMinutes = (minutes: number) => sql`now() + make_interval(mins => ${minutes}::int)`;

/**
 * What a try leaves on the row. `retryMinutes` null after a failure means that was
 * the last try and the delivery has failed.
 */
async function record(id: string, outcome: Outcome, retryMinutes: number | null) {
  await controlDb
    .update(partnerWebhookDeliveries)
    .set(
      outcome.ok
        ? {
            deliveredAt: sql`now()`,
            failedAt: null,
            nextAttemptAt: null,
            lastStatus: outcome.status,
            lastError: null,
          }
        : {
            lastStatus: outcome.status,
            lastError: outcome.error,
            nextAttemptAt: retryMinutes === null ? null : inMinutes(retryMinutes),
            failedAt: retryMinutes === null ? sql`now()` : null,
          },
    )
    .where(eq(partnerWebhookDeliveries.id, id));
}

/**
 * Drain the queue: every delivery whose next try is due. W2-X03.
 *
 * It ran once a day inside the billing cron with six tries, so a delivery could be a
 * day late, retries were a day apart, and one that used them all said "Pending" for
 * ever. Now it runs on the hourly wake, each failure waits longer (`retry.ts`), and
 * the last one writes `failed_at`.
 *
 * 🔴 CLAIMED BEFORE IT IS SENT. The try is counted and the row held in one
 * conditional UPDATE, so an overlapping run cannot send the same delivery twice and a
 * crash mid-flight spends the try rather than losing the delivery.
 *
 * 🔴 `now()` IS THE DATABASE'S, on both sides of every comparison (78.6).
 */
export async function deliverPending(
  limit = 50,
): Promise<{ sent: number; failed: number; gaveUp: number }> {
  const due = await controlDb
    .select({
      id: partnerWebhookDeliveries.id,
      event: partnerWebhookDeliveries.event,
      subjectId: partnerWebhookDeliveries.subjectId,
      url: partnerWebhooks.url,
      secretSealed: partnerWebhooks.secretSealed,
    })
    .from(partnerWebhookDeliveries)
    .innerJoin(partnerWebhooks, eq(partnerWebhooks.id, partnerWebhookDeliveries.webhookId))
    .where(
      and(
        isNull(partnerWebhookDeliveries.deliveredAt),
        isNull(partnerWebhookDeliveries.failedAt),
        isNull(partnerWebhooks.disabledAt),
        lte(partnerWebhookDeliveries.nextAttemptAt, sql`now()`),
      ),
    )
    .orderBy(partnerWebhookDeliveries.nextAttemptAt)
    .limit(limit);

  let sent = 0;
  let failed = 0;
  let gaveUp = 0;

  for (const delivery of due) {
    const [claimed] = await controlDb
      .update(partnerWebhookDeliveries)
      .set({
        attempts: sql`${partnerWebhookDeliveries.attempts} + 1`,
        /* Held an hour while in flight; `record` writes the real next time. */
        nextAttemptAt: inMinutes(60),
      })
      .where(
        and(
          eq(partnerWebhookDeliveries.id, delivery.id),
          isNull(partnerWebhookDeliveries.deliveredAt),
          isNull(partnerWebhookDeliveries.failedAt),
          lte(partnerWebhookDeliveries.nextAttemptAt, sql`now()`),
        ),
      )
      .returning({ attempts: partnerWebhookDeliveries.attempts });
    if (!claimed) continue;

    const outcome = await attempt(delivery);
    const retry = outcome.ok ? null : retryWaitMinutes(claimed.attempts);
    await record(delivery.id, outcome, retry);

    if (outcome.ok) sent += 1;
    else if (retry !== null) failed += 1;
    else gaveUp += 1;
  }

  if (sent + failed + gaveUp > 0) log.info("webhook deliveries drained", { sent, failed, gaveUp });
  return { sent, failed, gaveUp };
}

/**
 * 🔴 W2-X03: REDELIVER, BY HAND, NOW. One try, and the result shown on the spot.
 *
 * For a partner whose endpoint was down or whose own side lost what it received. A
 * failure leaves a failed delivery failed and a pending one on its schedule: a button
 * pressed in a hurry must not reset three days of backoff.
 *
 * Scoped in the WHERE through the endpoint's owner, so a borrowed delivery id sends
 * nothing.
 */
export async function redeliver(input: {
  partnerId: string;
  deliveryId: string;
}): Promise<Outcome | null> {
  const [delivery] = await controlDb
    .select({
      id: partnerWebhookDeliveries.id,
      event: partnerWebhookDeliveries.event,
      subjectId: partnerWebhookDeliveries.subjectId,
      url: partnerWebhooks.url,
      secretSealed: partnerWebhooks.secretSealed,
    })
    .from(partnerWebhookDeliveries)
    .innerJoin(partnerWebhooks, eq(partnerWebhooks.id, partnerWebhookDeliveries.webhookId))
    .where(
      and(
        eq(partnerWebhookDeliveries.id, input.deliveryId),
        eq(partnerWebhooks.partnerId, input.partnerId),
        isNull(partnerWebhooks.disabledAt),
      ),
    )
    .limit(1);
  if (!delivery) return null;

  await controlDb
    .update(partnerWebhookDeliveries)
    .set({ attempts: sql`${partnerWebhookDeliveries.attempts} + 1` })
    .where(eq(partnerWebhookDeliveries.id, delivery.id));

  const outcome = await attempt(delivery);
  if (outcome.ok) {
    await record(delivery.id, outcome, null);
  } else {
    await controlDb
      .update(partnerWebhookDeliveries)
      .set({ lastStatus: outcome.status, lastError: outcome.error })
      .where(eq(partnerWebhookDeliveries.id, delivery.id));
  }

  log.info("webhook redelivered by hand", { partner: ref(input.partnerId), ok: outcome.ok });
  return outcome;
}

/**
 * 🔴 W2-X03: SEND A TEST EVENT to one endpoint, now, and say what happened.
 *
 * `ping`, with a null id: the same three fields and the same signature as a real
 * delivery, so a partner can prove their verification code before a real event
 * depends on it. It goes in the delivery log like any other and is never retried:
 * the person who pressed the button is looking at the answer.
 */
export async function sendTestEvent(input: {
  partnerId: string;
  webhookId: string;
}): Promise<Outcome | null> {
  const [hook] = await controlDb
    .select({
      id: partnerWebhooks.id,
      url: partnerWebhooks.url,
      secretSealed: partnerWebhooks.secretSealed,
    })
    .from(partnerWebhooks)
    .where(
      and(
        eq(partnerWebhooks.id, input.webhookId),
        eq(partnerWebhooks.partnerId, input.partnerId),
        isNull(partnerWebhooks.disabledAt),
      ),
    )
    .limit(1);
  if (!hook) return null;

  const [row] = await controlDb
    .insert(partnerWebhookDeliveries)
    .values({
      webhookId: hook.id,
      event: WEBHOOK_TEST_EVENT,
      subjectId: null,
      attempts: 1,
      nextAttemptAt: null,
    })
    .returning({ id: partnerWebhookDeliveries.id });
  if (!row) return null;

  const outcome = await attempt({
    id: row.id,
    event: WEBHOOK_TEST_EVENT,
    subjectId: null,
    url: hook.url,
    secretSealed: hook.secretSealed,
  });
  await record(row.id, outcome, null);
  return outcome;
}

/** The delivery log a developer debugs from. 55.2. */
export async function deliveriesFor(partnerId: string, limit = 100) {
  return controlDb
    .select({
      id: partnerWebhookDeliveries.id,
      event: partnerWebhookDeliveries.event,
      subjectId: partnerWebhookDeliveries.subjectId,
      attempts: partnerWebhookDeliveries.attempts,
      lastStatus: partnerWebhookDeliveries.lastStatus,
      lastError: partnerWebhookDeliveries.lastError,
      deliveredAt: partnerWebhookDeliveries.deliveredAt,
      failedAt: partnerWebhookDeliveries.failedAt,
      nextAttemptAt: partnerWebhookDeliveries.nextAttemptAt,
      createdAt: partnerWebhookDeliveries.createdAt,
      url: partnerWebhooks.url,
      endpointDisabled: sql<boolean>`${partnerWebhooks.disabledAt} IS NOT NULL`,
    })
    .from(partnerWebhookDeliveries)
    .innerJoin(partnerWebhooks, eq(partnerWebhooks.id, partnerWebhookDeliveries.webhookId))
    .where(eq(partnerWebhooks.partnerId, partnerId))
    .orderBy(sql`${partnerWebhookDeliveries.createdAt} DESC`)
    .limit(limit);
}

/** Their endpoints. The sealed secret is never selected. */
export async function webhooksFor(partnerId: string) {
  return controlDb
    .select({
      id: partnerWebhooks.id,
      url: partnerWebhooks.url,
      events: partnerWebhooks.events,
      disabledAt: partnerWebhooks.disabledAt,
      createdAt: partnerWebhooks.createdAt,
      /*
       * 🔴 W2-X03: FAILING: its latest finished delivery failed and nothing has
       * reached it since. Read from the deliveries rather than stored, so it clears
       * itself the moment a redelivery or a test event gets through. The outer
       * id goes through qualified() (W2-Q01): bare, Drizzle renders "id" in a
       * single-table select, which inside the subquery means the delivery's own.
       */
      failing: sql<boolean>`COALESCE((
        SELECT d.failed_at IS NOT NULL FROM partner_webhook_deliveries d
         WHERE d.webhook_id = ${qualified(partnerWebhooks.id)}
           AND (d.failed_at IS NOT NULL OR d.delivered_at IS NOT NULL)
         ORDER BY COALESCE(d.delivered_at, d.failed_at) DESC
         LIMIT 1
      ), false)`,
    })
    .from(partnerWebhooks)
    .where(eq(partnerWebhooks.partnerId, partnerId));
}

export async function disableWebhook(partnerId: string, webhookId: string): Promise<{ ok: true }> {
  await controlDb
    .update(partnerWebhooks)
    .set({ disabledAt: new Date() })
    .where(
      and(
        eq(partnerWebhooks.id, webhookId),
        /* Scoped in the WHERE. A borrowed id disables nothing. */
        eq(partnerWebhooks.partnerId, partnerId),
      ),
    );

  log.info("webhook disabled", { partner: ref(partnerId) });
  return { ok: true };
}

/**
 * 🔴 THE ABSENCE, STATED SO A VERIFIER CAN FIND IT.
 *
 * No function here takes content, no row here stores content, and the delivery body is a
 * literal with three fields in it. 42.4 is a rule enforced by the shape of an argument
 * list, and that is invisible to a reader unless something says so out loud.
 */
export const A_WEBHOOK_CARRIES_NO_CONTENT = true;
