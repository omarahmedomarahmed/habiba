import "server-only";

import { log, safeErrorMessage } from "@/lib/logger";

import type { Message } from "./index";
import { templateFor, templateLanguage, templateStatus } from "./templates";

/**
 * WhatsApp, via the Meta Cloud API. C43, and the second half of PLAN.md 11.7.
 *
 * ## Status: written, untested against a real account, off by default
 *
 * Every line below runs the moment three environment variables exist. Nothing
 * here is a stub — the request shape, the template mapping and the error
 * handling are real — but it has never been run against a live WhatsApp
 * Business account, because there is not one. **Do not assume it works until
 * `scripts/whatsapp-check.ts` has printed a message id.**
 *
 * ## Why Meta Cloud API and not an aggregator
 *
 * Twilio and MessageBird are easier to start with and cost roughly double per
 * conversation, and both sit in the path of clinical-adjacent messages as a
 * third processor. Meta's own API is one processor fewer, is free for
 * service conversations a *user* initiates, and charges per 24-hour
 * conversation window for business-initiated ones — which is what a reminder
 * is. For an Egyptian practice that is the difference between a few dollars a
 * month and a few tens.
 *
 * The cost of that choice is honest: Meta's onboarding is slower, templates
 * need approval before they can be sent, and the approval can be refused.
 *
 * ## 🔴 The rule that matters more than the provider
 *
 * A WhatsApp message is stored on the recipient's phone, backed up to their
 * cloud, and visible in a notification on a lock screen somebody else may be
 * looking at. **No clinical content goes through here** — not a summary, not a
 * diagnosis, not a note. A time, a name, a link. The link goes to a page that
 * authenticates.
 *
 * ## Templates
 *
 * Meta requires business-initiated messages to use a template approved in
 * advance, with numbered variables. So each `Message.kind` maps to a template
 * name and `message.variables` supplies the values **in order**. A message
 * whose kind has no template is not sent by this channel — it falls back to
 * email rather than going out malformed.
 */

/*
 * 🔴 Task 40: the templates, their English and Arabic bodies and whether Meta
 * approved each, live in `./templates.ts`. The notes that used to sit here
 * (76.17, 11R.10, 13.3, 76.40, 21R.4, 76.14, phone change) still hold: an
 * authentication template carries one code and no link, and a join link is
 * never a variable because it is forwardable in one tap.
 */
export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Send one message. Returns false when this channel cannot carry it.
 *
 * `false` rather than an exception for the expected refusals — no template, no
 * configuration — so `notify()` falls through to email quietly. Only a real
 * transport failure throws, which is the case worth logging loudly.
 */
export async function sendWhatsapp(
  phone: string,
  message: Message,
  /** 🔴 Ruling 8: the recipient's language, used when Meta approved the template in it. */
  locale?: string | null,
): Promise<boolean> {
  /*
   * 🔴 0170: while the simulation runs, an invented number may be a real
   * stranger's. Kept in the outbox instead, and answered exactly as the live
   * rail would (not configured means not sent), so `notify()` falls back the
   * same way it would for a real person.
   */
  const { keep, simulationRunning } = await import("./outbox");
  if (simulationRunning()) {
    await keep({
      channel: "whatsapp",
      to: phone,
      subject: message.subject,
      body: [message.body, ...(message.variables ?? [])].filter(Boolean).join("\n"),
      kind: message.kind,
      reason: "simulation running",
    });
    return whatsappConfigured() && templateStatus(message.kind) === "approved";
  }
  if (!whatsappConfigured()) return false;

  const template = templateFor(message.kind);
  if (!template) {
    log.info("no whatsapp template for message kind", { kind: message.kind });
    return false;
  }
  /*
   * 🔴 Task 40: not approved by Meta yet, so not sent. Meta would refuse it and
   * the message would be lost; `notify()` sends the email or an in-app notice.
   */
  if (templateStatus(message.kind) !== "approved") {
    log.info("whatsapp template not approved yet", { kind: message.kind, template: template.name });
    return false;
  }

  const variables = message.variables ?? [];
  if (variables.length !== template.variables) {
    /*
     * A template sent with the wrong number of variables is rejected by Meta
     * with a 400, and the message is lost. Refusing here means it goes by
     * email instead — the wrong channel beats no message.
     */
    log.warn("whatsapp template variable mismatch", {
      kind: message.kind,
      expected: template.variables,
      got: variables.length,
    });
    return false;
  }

  /*
   * 11R.13 — refuse a number we cannot prove is E.164 rather than sending
   * something Meta will bounce.
   *
   * The old line was `phone.replace(/[^\d]/g, "")`, which turned an Egyptian
   * `0100 123 4567` into `01001234567` — a string Meta rejects, and one that
   * cannot be repaired here because expanding it needs a country nobody asked
   * for (C64). Numbers are stored E.164 now; anything that is not is a bug
   * upstream, and falling back to email is the right response to it.
   */
  const { isE164 } = await import("@/lib/phone/e164");
  if (!isE164(phone)) {
    log.warn("whatsapp refused a number that is not E.164", { kind: message.kind });
    return false;
  }

  const to = phone.slice(1);

  const url = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template.name,
          /*
           * 🔴 Ruling 8: their language when Meta approved the template in it,
           * otherwise `WHATSAPP_TEMPLATE_LANGUAGE` (default `ar`) as before.
           */
          language: { code: templateLanguage(message.kind, locale) ?? "ar" },
          components: [
            {
              type: "body",
              parameters: variables.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      // Meta's error body carries a code worth reading in the logs; the body
      // itself is not logged, because it echoes the message we just sent.
      const detail = (await response.json().catch(() => ({}))) as {
        error?: { code?: number; message?: string };
      };
      log.warn("whatsapp rejected", {
        kind: message.kind,
        status: response.status,
        code: detail.error?.code ?? 0,
      });
      return false;
    }

    log.info("whatsapp sent", { kind: message.kind });
    return true;
  } catch (error) {
    // A transport failure, not a refusal. Thrown so `notify()` logs it and
    // falls back deliberately rather than treating it as "no channel".
    throw new Error(`whatsapp transport: ${safeErrorMessage(error)}`);
  }
}
