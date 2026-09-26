import type { MessageKey } from "@/lib/i18n/messages";

import type { Message } from "./index";

/**
 * 🔴 WHO READS A MESSAGE, AND WHY IT REACHED THEM, DECIDE THE LINE UNDER IT.
 *
 * The shared mail footer used to be one sentence for everybody: "sent by
 * 24Therapy about an appointment you booked", or "sent by your therapist" when
 * a sender forgot to pass one. So a practice manager's invitation, a company's
 * payment receipt, the back office's sign-in code and a clinician's own
 * password reset all told their reader about an appointment they never booked
 * (round 1, B15, B23, B41, B52). A footer that does not fit its reader is what
 * makes a real transactional email read as a phish.
 *
 * So every email carries a `Footing`: the reader, and the occasion. Pure, so a
 * test and a verifier can read it without a database.
 */

export const READERS = ["patient", "clinician", "manager", "company", "partner", "staff"] as const;
export type Reader = (typeof READERS)[number];

/**
 * Why it reached them:
 *   asked      they asked for it: a code, a reset, a reply. Any reader.
 *   booking    about an appointment; a patient's booking line.
 *   therapist  sent on their clinician's behalf; a patient only.
 *   account    about the account they hold, in the reader's own words.
 *   invited    a practice gave this address to invite them, and they hold no
 *              account with us yet; a clinician asked to join a practice.
 */
export type Occasion = "asked" | "booking" | "therapist" | "account" | "invited";

export type Footing = { reader: Reader; occasion: Occasion };

export type MessageKind = Message["kind"];

/**
 * Every kind `notify` sends, with the reader it goes to. A `Record` over the
 * union, so a new kind without a line here fails the type check. Where one
 * kind reaches more than one kind of reader (a payment, a renewal), this is the
 * usual one and the sender passes `reader` on the recipient.
 */
export const FOOTING_OF_KIND: Record<MessageKind, Footing> = {
  "booking.confirmed": { reader: "patient", occasion: "booking" },
  "booking.reminder": { reader: "patient", occasion: "booking" },
  "booking.cancelled": { reader: "patient", occasion: "booking" },
  "booking.rescheduled": { reader: "patient", occasion: "booking" },
  "booking.patient_cancelled": { reader: "clinician", occasion: "account" },
  "booking.patient_moved": { reader: "clinician", occasion: "account" },
  "session.started": { reader: "patient", occasion: "booking" },
  "session.invite": { reader: "patient", occasion: "therapist" },
  "session.summary_ready": { reader: "patient", occasion: "therapist" },
  "claim.code": { reader: "patient", occasion: "asked" },
  "claim.invite": { reader: "patient", occasion: "therapist" },
  "clinic.removed": { reader: "clinician", occasion: "account" },
  "clinic.staff_invite": { reader: "manager", occasion: "account" },
  "checkin.asking": { reader: "patient", occasion: "account" },
  "payout.sent": { reader: "clinician", occasion: "account" },
  "payout.rejected": { reader: "clinician", occasion: "account" },
  "payout.returned": { reader: "clinician", occasion: "account" },
  "payout.overdue": { reader: "staff", occasion: "account" },
  "ops.oneHandDigest": { reader: "staff", occasion: "account" },
  "ops.receiptAsked": { reader: "staff", occasion: "account" },
  "ops.returnAsked": { reader: "staff", occasion: "account" },
  "ops.watchdog": { reader: "staff", occasion: "account" },
  "licence.expired": { reader: "clinician", occasion: "account" },
  "licence.expiring": { reader: "clinician", occasion: "account" },
  "renewal.due_soon": { reader: "clinician", occasion: "account" },
  "support.closed": { reader: "patient", occasion: "asked" },
  "support.received": { reader: "patient", occasion: "asked" },
  "phone.verify": { reader: "patient", occasion: "asked" },
  "password.reset_code": { reader: "patient", occasion: "asked" },
  "staff.second_factor_code": { reader: "staff", occasion: "asked" },
  "record.export": { reader: "patient", occasion: "asked" },
  "consent.granted": { reader: "patient", occasion: "account" },
  "homework.set": { reader: "patient", occasion: "therapist" },
  "assessment.sent": { reader: "patient", occasion: "therapist" },
  "history.answered": { reader: "patient", occasion: "account" },
  "benefit.verify_code": { reader: "patient", occasion: "asked" },
  /* Board 389: sent to the mailbox at the domain, which holds no account here. */
  "sponsor.domain_confirm": { reader: "company", occasion: "asked" },
  "sponsor.enquiry_received": { reader: "company", occasion: "asked" },
  "sponsor.enquiry": { reader: "staff", occasion: "account" },
  "sponsor.invite": { reader: "company", occasion: "account" },
  "sponsor.password_reset": { reader: "company", occasion: "asked" },
  "partner.limit_approaching": { reader: "partner", occasion: "account" },
  "sponsor.pot_empty": { reader: "company", occasion: "account" },
  "sponsor.pot_low": { reader: "company", occasion: "account" },
  "sponsor.pot_expiring": { reader: "company", occasion: "account" },
  "payment.submitted": { reader: "patient", occasion: "account" },
  "payment.confirmed": { reader: "patient", occasion: "account" },
  "payment.rejected": { reader: "patient", occasion: "account" },
  "payment.wallet_credited": { reader: "patient", occasion: "account" },
};

/**
 * The footing of one message: its kind's, with the sender's reader when the
 * sender knows better. A booking or a clinician's-behalf occasion belongs to a
 * patient, so it falls back to the account line for anybody else.
 */
export function footingFor(kind: MessageKind, reader?: Reader | null): Footing {
  const usual = FOOTING_OF_KIND[kind];
  if (!reader || reader === usual.reader) return usual;
  const occasion = usual.occasion === "asked" ? "asked" : "account";
  return { reader, occasion };
}

const ACCOUNT_LINE: Record<Reader, MessageKey> = {
  patient: "mail.footer.patient",
  clinician: "tmsg.mail.footer",
  manager: "mail.footer.manager",
  company: "mail.footer.company",
  partner: "mail.footer.partner",
  staff: "mail.footer.staff",
};

/** The two footer lines for one footing, as dictionary keys. */
export function footerKeys(footing: Footing): [MessageKey, MessageKey] {
  if (footing.occasion === "asked") return ["mail.footer.asked", "mail.footer.askedIgnore"];
  if (footing.occasion === "invited") return ["mail.footer.invited", "pmsg.mail.ignore"];
  if (footing.reader === "patient" && footing.occasion === "therapist") {
    return ["pmsg.mail.fromTherapist", "pmsg.mail.ignore"];
  }
  if (footing.reader === "patient" && footing.occasion === "booking") {
    return ["pmsg.mail.aboutBooking", "pmsg.mail.ignore"];
  }
  return [ACCOUNT_LINE[footing.reader], "pmsg.mail.ignore"];
}
