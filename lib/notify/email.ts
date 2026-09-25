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
 * 🔴 THIS SAID THE RESEND DOMAIN WAS NOT VERIFIED. LIVE DNS SAYS OTHERWISE.
 *
 * `resend._domainkey.24therapy.app` publishes a DKIM key, and so does
 * `zmail._domainkey` for the mailboxes. The note was true when it was written
 * and has been false for an unknown number of sprints, which is exactly the
 * kind of sentence that decides what somebody does next: a reader planning the
 * launch would have scheduled work that is already done.
 *
 * `npm run verify:email-dns` asks DNS rather than asking this comment, and
 * `docs/EMAIL-DNS.md` records what is actually published and what is not.
 * What is not, as of the audit, is DMARC.
 */
export async function sendNotificationEmail(
  to: string,
  message: Message,
  /** 🔴 Ruling 8: the language the words are in, so the shell and its direction match. */
  locale?: string | null,
): Promise<boolean> {
  return sendNotification({
    to,
    subject: message.subject,
    body: message.body,
    link: message.link ?? null,
    locale,
  });
}
