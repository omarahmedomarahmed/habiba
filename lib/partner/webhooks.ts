import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { and, eq, isNull, lt, sql } from "drizzle-orm";

import { encryptSecret, decryptSecret, secretsConfigured } from "@/lib/crypto/secretbox";
import { controlDb } from "@/lib/db";
import {
  partnerWebhookDeliveries,
  partnerWebhooks,
  type WebhookEvent,
} from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";

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

const MAX_ATTEMPTS = 6;

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
 * Drain the queue. Called from the cron, beside the other sweeps.
 *
 * 🔴 THE BODY IS BUILT HERE AND IT IS THREE FIELDS. Not assembled from a row, not spread
 * from an object a caller passed: written out, so a future edit that wanted to add
 * content would have to add it to this literal in a diff somebody reads.
 */
export async function deliverPending(limit = 50): Promise<{ sent: number; failed: number }> {
  const pending = await controlDb
    .select({
      id: partnerWebhookDeliveries.id,
      event: partnerWebhookDeliveries.event,
      subjectId: partnerWebhookDeliveries.subjectId,
      attempts: partnerWebhookDeliveries.attempts,
      url: partnerWebhooks.url,
      secretSealed: partnerWebhooks.secretSealed,
    })
    .from(partnerWebhookDeliveries)
    .innerJoin(partnerWebhooks, eq(partnerWebhooks.id, partnerWebhookDeliveries.webhookId))
    .where(
      and(
        isNull(partnerWebhookDeliveries.deliveredAt),
        isNull(partnerWebhooks.disabledAt),
        lt(partnerWebhookDeliveries.attempts, MAX_ATTEMPTS),
      ),
    )
    .limit(limit);

  let sent = 0;
  let failed = 0;

  for (const delivery of pending) {
    /* Counted first and unconditionally, so a crash mid-flight spends the attempt. */
    await controlDb
      .update(partnerWebhookDeliveries)
      .set({ attempts: sql`${partnerWebhookDeliveries.attempts} + 1` })
      .where(eq(partnerWebhookDeliveries.id, delivery.id));

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
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        await controlDb
          .update(partnerWebhookDeliveries)
          .set({ deliveredAt: new Date(), lastStatus: response.status, lastError: null })
          .where(eq(partnerWebhookDeliveries.id, delivery.id));
        sent += 1;
      } else {
        await controlDb
          .update(partnerWebhookDeliveries)
          .set({ lastStatus: response.status })
          .where(eq(partnerWebhookDeliveries.id, delivery.id));
        failed += 1;
      }
    } catch (error) {
      await controlDb
        .update(partnerWebhookDeliveries)
        .set({ lastError: safeErrorMessage(error).slice(0, 300) })
        .where(eq(partnerWebhookDeliveries.id, delivery.id));
      failed += 1;
    }
  }

  if (sent + failed > 0) log.info("webhook deliveries drained", { sent, failed });
  return { sent, failed };
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
      createdAt: partnerWebhookDeliveries.createdAt,
      url: partnerWebhooks.url,
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
