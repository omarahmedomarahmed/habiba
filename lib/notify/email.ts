import "server-only";

import { sendNotification } from "@/lib/mail";

import type { Message } from "./index";

/**
 * The email channel. PLAN.md 11.7.
 *
 * A four-line adapter, on purpose. Everything about how an email looks — the
 * shell, the escaping, the from-address, the footer — belongs in `lib/mail.ts`
 * and stays there; a second implementation here would drift from it and the
 * drift would show up as a transactional email that looks like a phish.
 *
 * ⚠️ **The Resend domain is not verified yet.** Until it is, `sendMail` logs
 * and returns false rather than delivering — which is the right failure, and
 * why `notify()` reports `sent: false` up to the screen instead of assuming.
 * 11.7's own note: build it, do not wait on it.
 */
export async function sendNotificationEmail(to: string, message: Message): Promise<boolean> {
  return sendNotification({
    to,
    subject: message.subject,
    body: message.body,
    link: message.link ?? null,
  });
}
