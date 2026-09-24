/**
 * 🔴 C18: THE MAILBOXES A DOMAIN PROOF MAY GO TO, and only these.
 *
 * It went to `postmaster@` alone, once, with no way to send it again: a domain
 * whose postmaster is unread (common on hosted mail) could never be proved. So
 * the company picks one of the administrative names RFC 2142 reserves, the same
 * set certificate authorities mail for domain control, and can send again.
 * Never an address it types: letting a company name the mailbox would let it
 * name its own, which proves nothing about who runs the domain.
 *
 * Its own file, without `server-only`, because the picker on the domains
 * screen renders the same list the server accepts.
 */
export const ADMIN_MAILBOXES = ["admin", "administrator", "hostmaster", "postmaster", "webmaster"] as const;
export type AdminMailbox = (typeof ADMIN_MAILBOXES)[number];

export function isAdminMailbox(value: unknown): value is AdminMailbox {
  return typeof value === "string" && (ADMIN_MAILBOXES as readonly string[]).includes(value);
}
