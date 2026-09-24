"use server";

import { revalidatePath } from "next/cache";

import { requirePartnerAdmin } from "@/lib/partner-auth/guard";
import {
  disableWebhook,
  redeliver,
  registerWebhook,
  sendTestEvent,
} from "@/lib/partner/webhooks";
import type { WebhookEvent } from "@/lib/db/schema";

export type WebhookState = { error?: string; secret?: string };

/**
 * 42.4 / 55.10 — register an endpoint.
 *
 * 🔴 The partner id comes from the actor, never the form, so an endpoint cannot be attached
 * to somebody else's account by anybody who can edit a request body.
 *
 * 🔴 THE EVENTS ARE THE ONLY THING THIS FORM CAN SAY ABOUT A DELIVERY. There is no payload
 * template, no field picker and no "include the note" checkbox, because `queueWebhook` has
 * no parameter one could feed and the row has nowhere to put one.
 */
export async function addWebhook(_prev: WebhookState, formData: FormData): Promise<WebhookState> {
  const actor = await requirePartnerAdmin();

  const result = await registerWebhook({
    partnerId: actor.partnerId,
    url: String(formData.get("url") ?? ""),
    events: formData.getAll("events").map(String) as WebhookEvent[],
  });

  if (result.error || !result.webhook) {
    return { error: result.error ?? "That endpoint could not be saved." };
  }

  revalidatePath("/partner/webhooks");
  /* 🔴 Shown once. Only the sealed form is stored, and `registerWebhook` refuses to store
     a secret at all on a deployment with no key rather than writing one in clear. */
  return { secret: result.webhook.secret };
}

/** What a try came back with, for the button that asked. W2-X03. */
export type TryResult = { ok?: boolean; status?: number | null; error?: string | null };

/**
 * 🔴 W2-X03 — SEND A TEST EVENT, and show what their endpoint answered.
 *
 * An admin act, because it sends a signed request to their production endpoint. The
 * webhook id is checked against the actor's partner inside `sendTestEvent`.
 */
export async function sendTest(webhookId: string): Promise<TryResult> {
  const actor = await requirePartnerAdmin();
  const result = await sendTestEvent({ partnerId: actor.partnerId, webhookId });
  if (!result) return { error: "That endpoint is disabled or no longer yours." };
  revalidatePath("/partner/webhooks");
  revalidatePath("/partner/deliveries");
  return result;
}

/** 🔴 W2-X03 — REDELIVER one delivery now, by hand. Same scoping, same answer. */
export async function redeliverOne(deliveryId: string): Promise<TryResult> {
  const actor = await requirePartnerAdmin();
  const result = await redeliver({ partnerId: actor.partnerId, deliveryId });
  if (!result) return { error: "That endpoint is disabled or no longer yours." };
  revalidatePath("/partner/deliveries");
  revalidatePath("/partner/webhooks");
  return result;
}

export async function disable(formData: FormData): Promise<void> {
  const actor = await requirePartnerAdmin();
  await disableWebhook(actor.partnerId, String(formData.get("webhookId") ?? ""));
  revalidatePath("/partner/webhooks");
}
