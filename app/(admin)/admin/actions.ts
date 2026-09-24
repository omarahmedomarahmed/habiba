"use server";

import { after } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { CMS_TAG, saveContentPage } from "@/lib/content/service";
import { honestyMessage, honestyProblemsIn } from "@/lib/content/honesty";
import { and, eq, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { requireRole, requireStaff } from "@/lib/auth/guard";
import { reasonProblem, reasonText } from "@/lib/admin/reason";
import { refundSessionPayment } from "@/lib/billing/connect";
import { discountInvoice, setUpcomingDiscount } from "@/lib/billing/service";
import { allTherapistRecipients, setUserStatus, setVerification } from "@/lib/data/admin";
import { decideVerification } from "@/lib/data/verification";
import { sanitiseBlocks } from "@/lib/content/sanitise";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import {
  contentPages,
  invoices,
  therapistVerifications,
  users,
  LEDGER_ACCOUNTS,
  TAXONOMY_KINDS,
  type ContentBlock,
  type LedgerAccount,
  type TaxonomyKind,
} from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { sendTherapistMessage } from "@/lib/mail";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(admin)/admin/actions.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


export type AdminActionState = { error?: string; ok?: boolean; proposed?: boolean };

/**
 * 🔴 W2-A05: one reason rule for every destructive or customer-visible act
 * (`lib/admin/reason.ts`), the same number the confirm step enables at, said
 * in the reader's language.
 */
async function reasonRefused(reason: unknown): Promise<string | null> {
  const problem = reasonProblem(reason);
  if (!problem) return null;
  const { getI18n } = await import("@/lib/i18n/server");
  return (await getI18n()).t(problem);
}

export async function suspendUser(
  userId: string,
  suspend: boolean,
  reason: string,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");
  const refused = await reasonRefused(reason);
  if (refused) return { error: refused };
  await setUserStatus(userId, suspend ? "suspended" : "active");
  await audit({
    actor,
    category: "admin",
    action: suspend ? "user.suspend" : "user.reinstate",
    resourceType: "user",
    resourceId: userId,
    reason: reasonText(reason),
  });
  revalidatePath("/admin/therapists");
  return { ok: true };
}

export async function verifyUser(
  userId: string,
  status: "verified" | "rejected" | "pending",
  reason: string,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");
  const refused = await reasonRefused(reason);
  if (refused) return { error: refused };
  await setVerification(userId, status, actor.userId);
  await audit({
    actor,
    category: "admin",
    action: `user.verification.${status}`,
    resourceType: "user",
    resourceId: userId,
    reason: reasonText(reason),
  });
  revalidatePath("/admin/therapists");
  revalidatePath("/admin/verifications");
  return { ok: true };
}

/**
 * Save a CMS page.
 *
 * Blocks are validated into a known shape before they are stored. Nothing here
 * accepts HTML, and the renderer has no `dangerouslySetInnerHTML` — an
 * admin-authored script tag on the public origin would run in the same cookie
 * scope as the clinician portal, which is a straight line from "edit the
 * marketing copy" to "read a session cookie".
 */
export async function savePage(
  pageId: string,
  input: { title: string; description: string; status: "draft" | "published"; blocks: unknown },
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");

  if (!input.title.trim()) return { error: "A title is required." };

  const blocks = sanitiseBlocks(input.blocks);
  if (!blocks) return { error: "The content structure is not valid. Check the block editor." };

  /*
   * 🔴 28.2 / 28.3 / C109 / C110 — two claims this product may not make.
   *
   * Refused at the save rather than caught by a reviewer, because a marketing
   * sentence is written by whoever is writing marketing that afternoon and the
   * arithmetic is not in front of them. The message names the sentence and
   * says what the true version is, so the refusal is usable rather than
   * merely correct.
   *
   * `verify:sprint28` scans the published ROWS as well: this stops the next
   * one being written, and C148 is the reminder that it does nothing about
   * the ones already in the database.
   */
  const dishonest = honestyProblemsIn(input.title.trim() || "this page", blocks);
  if (dishonest.length > 0) return { error: honestyMessage(dishonest[0]!) };

  /*
   * 🔴 W2-A07: a draft of a live page is kept beside it and the live page
   * stays up (`saveContentPage`). This wrote the draft status onto the live
   * row, and `readPage` returns null for a draft, so the public page was gone
   * until somebody pressed Publish.
   */
  const page = await saveContentPage({
    pageId,
    title: input.title.trim(),
    description: input.description.trim() || null,
    status: input.status,
    blocks,
    userId: actor.userId,
  });
  if (!page) return { error: "That page no longer exists." };

  await audit({
    actor,
    category: "admin",
    action: "content.save",
    resourceType: "content_page",
    resourceId: pageId,
    reason: page.kept === "live" ? "draft saved beside the live page" : page.kept,
  });

  /*
   * Publishing is now the *only* thing that refreshes the public site.
   *
   * The marketing pages used to regenerate on a one-hour timer, which meant
   * one visitor an hour was enough to keep the database awake around the
   * clock — the same duty cycle as the cron that was removed for exactly that
   * reason. The page data is cached until this line runs.
   *
   * The whole tag rather than one path: the navigation and the footer are
   * built from this same table, so editing one page's label changes the header
   * on every other page. Invalidating one path would leave the rest showing a
   * stale menu, which is a worse bug than a broader invalidation of content
   * that changes a few times a month.
   */
  revalidateTag(CMS_TAG);
  revalidatePath("/admin/content");
  return { ok: true };
}

export async function applyInvoiceDiscount(
  invoiceId: string,
  discountCents: number,
  reason: string,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");
  const refused = await reasonRefused(reason);
  if (refused) return { error: refused };

  const result = await discountInvoice({
    invoiceId,
    discountCents,
    reason,
    adminUserId: actor.userId,
  });
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "billing",
    action: "invoice.discount",
    resourceType: "invoice",
    resourceId: invoiceId,
    reason: `${discountCents} cents, ${reason}`,
  });

  revalidatePath("/admin/vault");
  return { ok: true };
}

/* ------------------------------------------------------------------ email -- */

/**
 * Email one clinician, or all of them.
 *
 * Plain text only — see `sendTherapistMessage`. Sends run through `after()` so
 * a broadcast to a few hundred people does not hold the request open, and the
 * audit entry is written before any of them go out: a send that half-succeeds
 * must still leave a record that it was attempted.
 */
export async function emailTherapist(
  userId: string,
  subject: string,
  body: string,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");

  const problem = messageProblem(subject, body);
  if (problem) return { error: problem };

  const [recipient] = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!recipient) return { error: "That clinician no longer exists." };

  await audit({
    actor,
    category: "admin",
    action: "email.therapist",
    resourceType: "user",
    resourceId: userId,
    reason: subject.trim().slice(0, 200),
  });

  const sent = await sendTherapistMessage({
    to: recipient.email,
    firstName: recipient.firstName,
    subject: subject.trim(),
    body,
  });

  if (!sent) {
    return { error: "Email is not configured on this deployment, or the send was rejected." };
  }
  return { ok: true };
}

export async function announceToAllTherapists(
  subject: string,
  body: string,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");

  const problem = messageProblem(subject, body);
  if (problem) return { error: problem };

  const recipients = await allTherapistRecipients();
  if (recipients.length === 0) return { error: "There is nobody to send this to." };

  await audit({
    actor,
    category: "admin",
    action: "email.announcement",
    resourceType: "user",
    reason: `${recipients.length} recipients, ${subject.trim().slice(0, 160)}`,
  });

  const trimmedSubject = subject.trim();

  after(async () => {
    for (const recipient of recipients) {
      // Sequential, not Promise.all: a few hundred simultaneous sends is how
      // you get rate-limited by the provider and silently drop half the list.
      await sendTherapistMessage({
        to: recipient.email,
        firstName: recipient.firstName,
        subject: trimmedSubject,
        body,
        announcement: true,
      });
    }
    log.info("announcement sent", { recipients: recipients.length });
  });

  return { ok: true };
}

function messageProblem(subject: string, body: string): string | null {
  if (!subject.trim()) return "Give it a subject line.";
  if (subject.trim().length > 150) return "That subject line is too long.";
  if (!body.trim()) return "Write something to send.";
  if (body.length > 10_000) return "That message is too long for an email.";
  return null;
}

/* ----------------------------------------------------------- verification -- */

/**
 * Approve or reject a clinician.
 *
 * A rejection must carry a reason, because the reason is emailed to them
 * verbatim. "Rejected" with no explanation produces a support ticket and a
 * resubmission of the identical documents.
 */
export async function decideTherapistVerification(
  verificationId: string,
  approve: boolean,
  note: string,
): Promise<AdminActionState> {
  /*
   * 🔴 W2-A01 / D9: staff decide verifications, not only the founder. The
   * reviewer reads the documents through the audited route, and nobody
   * decides their own (`decideVerification` refuses it in its WHERE).
   */
  const actor = await requireStaff();

  const [own] = await db
    .select({ id: therapistVerifications.id })
    .from(therapistVerifications)
    .where(
      and(
        eq(therapistVerifications.id, verificationId),
        eq(therapistVerifications.userId, actor.userId),
      ),
    )
    .limit(1);
  if (own) {
    const { getI18n } = await import("@/lib/i18n/server");
    return { error: (await getI18n()).t("aaccess.ownVerification") };
  }

  const trimmed = note.trim();
  if (!approve && !trimmed) {
    return { error: "Say what is wrong. They see this word for word." };
  }

  const decided = await decideVerification({
    verificationId,
    approve,
    note: trimmed,
    adminUserId: actor.userId,
  });

  if (!decided) {
    return { error: "Somebody already reviewed this one." };
  }
  /* 🔴 0154 — recorded, not decided: a second reviewer confirms it. */
  if (decided.proposed) {
    await audit({
      actor,
      category: "admin",
      action: approve ? "verification.propose_approve" : "verification.propose_reject",
      resourceType: "verification",
      resourceId: verificationId,
      reason: trimmed || (approve ? "approve" : "reject"),
    });
    revalidatePath("/admin/verifications");
    return { ok: true, proposed: true };
  }

  await audit({
    actor,
    category: "admin",
    action: approve ? "verification.approve" : "verification.reject",
    resourceType: "verification",
    resourceId: verificationId,
    /*
     * 🔴 C351 — the count and the clearing are in the audit line, because
     * deleting somebody's identity documents is an act and "verification.reject"
     * alone does not record that it happened.
     */
    reason: approve
      ? "approved"
      : `${trimmed} [rejection ${decided.rejectionCount}${decided.documentsCleared ? ", documents cleared" : ""}]`,
  });

  const [person] = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, decided.userId))
    .limit(1);

  if (person && decided.recheck) {
    /*
     * 🔴 W1-23: a licence change on somebody already approved. They were
     * cleared throughout, so neither answer is "you are verified" or "we need
     * something else"; it is about the change.
     */
    const { stringsFor } = await import("@/lib/i18n/strings");
    const { t } = await stringsFor("en");
    after(() =>
      sendTherapistMessage({
        to: person.email,
        firstName: person.firstName,
        subject: t(approve ? "tlic.changeApproved" : "tlic.changeRejectedTitle"),
        body: approve
          ? t("tlic.changeApproved")
          : t("tlic.changeRejected", { note: trimmed }),
      }),
    );
  } else if (person) {
    after(() =>
      sendTherapistMessage({
        to: person.email,
        firstName: person.firstName,
        subject: approve ? "You are verified on 24Therapy" : "We need something else from you",
        body: approve
          ? `Your practice has been verified. You can start sessions, go on the Crisis Radar and take payments from patients right away.\n\nYour first completed session is on us.`
          : /*
             * 🔴 C351 — the second no tells them what it cost, in the same
             * message that gives the reason. Discovering that the documents are
             * gone by signing in and finding empty slots is how a decision we
             * made on purpose reads as a product that lost their files.
             */
            decided.documentsCleared
            ? `We could not verify your practice.\n\n${trimmed}\n\nThis is the second time we have looked, so we have not kept the documents you sent. If you want us to look again, sign in and upload them fresh along with anything that answers the above.`
            : `We could not verify your practice yet.\n\n${trimmed}\n\nSign in and update your details. It goes straight back to the front of our queue.`,
      }),
    );
  }

  revalidatePath("/admin/verifications");
  revalidatePath("/admin/therapists");
  return { ok: true };
}

/* ---------------------------------------------------------------- invoices -- */

/**
 * Edit an invoice outright — amount, description, or void it.
 *
 * Discounting is the everyday tool and stays separate; this is for the cases a
 * discount cannot express, like a bill raised against the wrong practice. A
 * paid invoice can only be voided, never re-priced: rewriting the amount on
 * money that has already moved makes the ledger disagree with Stripe, and the
 * ledger is the thing we show investors.
 */
export async function editInvoice(
  invoiceId: string,
  input: { amountCents?: number; description?: string; status?: "due" | "void" },
  reason: string,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");

  const refused = await reasonRefused(reason);
  if (refused) return { error: refused };
  const trimmedReason = reasonText(reason);

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!invoice) return { error: "Invoice not found." };

  const patch: Partial<typeof invoices.$inferInsert> = {};

  if (input.description !== undefined) {
    const description = input.description.trim();
    if (!description) return { error: "An invoice needs a description." };
    patch.description = description.slice(0, 200);
  }

  if (input.amountCents !== undefined) {
    if (invoice.status === "paid") {
      return { error: "That invoice is paid. Void it or refund in Stripe instead of re-pricing." };
    }
    if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
      return { error: "Enter a whole dollar amount." };
    }
    patch.amountCents = input.amountCents;
    // A discount larger than the new amount would make the payable negative.
    patch.discountCents = Math.min(invoice.discountCents, input.amountCents);
  }

  if (input.status) {
    if (input.status === "due" && invoice.status === "paid") {
      return { error: "Reopening a paid invoice would contradict Stripe." };
    }
    patch.status = input.status;
    if (input.status === "void") patch.paidAt = null;
  }

  if (Object.keys(patch).length === 0) return { error: "Nothing to change." };

  await db.update(invoices).set(patch).where(eq(invoices.id, invoiceId));

  await audit({
    actor,
    category: "billing",
    action: "invoice.edit",
    resourceType: "invoice",
    resourceId: invoiceId,
    reason: `${JSON.stringify(patch)}, ${trimmedReason}`,
  });

  revalidatePath("/admin/vault");
  revalidatePath("/admin/therapists");
  return { ok: true };
}

/**
 * Refund a patient who paid for a session that did not happen.
 *
 * Kept as an admin action rather than something a therapist can do to their own
 * payments: the money is reversed out of *their* Stripe balance, and "the
 * person who owes the refund decides whether to issue it" is not a support
 * policy, it is a dispute waiting to become a chargeback.
 */
export async function refundPatient(
  paymentId: string,
  reason: string,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");

  const trimmed = reason.trim();
  if (!trimmed) return { error: "Say why, this ends up in the audit log." };

  const result = await refundSessionPayment({
    paymentId,
    reason: trimmed,
    adminUserId: actor.userId,
  });
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "billing",
    action: "payment.refund",
    resourceType: "session_payment",
    resourceId: paymentId,
    reason: trimmed,
  });

  revalidatePath("/admin/vault");
  return { ok: true };
}

/**
 * Push a clinician's held earnings out now.
 *
 * Three automatic paths already do this — the webhook, the settings page, the
 * nightly sweep — and this exists for the case none of them can help with: a
 * clinician on the phone saying their money has not arrived. It fails loudly
 * with Stripe's own reason rather than pretending, because "we tried and Stripe
 * says the account is not verified" is an answer somebody can act on and
 * "nothing happened" is not.
 */
export async function releaseTherapistEarnings(
  therapistId: string,
  reason: string,
): Promise<AdminActionState & { movedCents?: number }> {
  const actor = await requireRole("super_admin");
  const refused = await reasonRefused(reason);
  if (refused) return { error: refused };

  const { releaseHeldEarnings } = await import("@/lib/billing/connect");
  const result = await releaseHeldEarnings(therapistId, { adminUserId: actor.userId });
  if (result.error) return { error: result.error };
  if (result.movedCents === 0) return { error: "There is nothing held for this clinician." };

  await audit({
    actor,
    category: "billing",
    action: "earnings.release",
    resourceType: "user",
    resourceId: therapistId,
    reason: `Released ${result.movedCents} cents, ${reasonText(reason)}`,
  });

  revalidatePath("/admin/vault");
  return { ok: true, movedCents: result.movedCents };
}

/**
 * Move a number in the books by hand.
 *
 * The escape hatch, and deliberately an uncomfortable one: it demands a reason,
 * records who, and posts a balanced pair rather than editing a balance. There
 * is no way to make the ledger disagree with itself from here, which is the
 * only property that makes an escape hatch safe to have.
 */
export async function adjustLedger(input: {
  organizationId: string;
  therapistId: string | null;
  account: LedgerAccount;
  amountCents: number;
  reason: string;
}): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");
  // W2-A05: the screen asked for a sentence and the server never checked one.
  const refused = await reasonRefused(input.reason);
  if (refused) return { error: refused };

  if (!LEDGER_ACCOUNTS.includes(input.account)) return { error: "Unknown account." };

  const { postAdjustment } = await import("@/lib/billing/ledger");
  const result = await postAdjustment({ ...input, adminUserId: actor.userId });
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "billing",
    action: "ledger.adjust",
    resourceType: "organization",
    resourceId: input.organizationId,
    reason: `${input.account} ${input.amountCents}, ${input.reason.trim()}`,
  });

  revalidatePath("/admin/vault");
  return { ok: true };
}

/** Credit applied to a subscriber's next renewal, consumed once. */
export async function applyUpcomingDiscount(
  organizationId: string,
  discountCents: number,
  reason: string,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");
  // W2-A05: no reason and no amount check, and it overwrote any existing credit silently.
  const refused = await reasonRefused(reason);
  if (refused) return { error: refused };
  if (!Number.isInteger(discountCents) || discountCents <= 0) return { error: "Enter a whole number of cents above zero." };

  await setUpcomingDiscount({ organizationId, discountCents, reason: reasonText(reason) });

  await audit({
    actor,
    category: "billing",
    action: "subscription.upcoming_discount",
    resourceType: "organization",
    resourceId: organizationId,
    reason: `${discountCents} cents, ${reason}`,
  });

  revalidatePath("/admin/vault");
  return { ok: true };
}

/**
 * A patient wrote in asking for their data.
 *
 * This is the support path that impersonation was going to be for, and it is
 * strictly less powerful on purpose: the admin causes the record to be sent and
 * never sees it. What comes back here is an email address and a confirmation —
 * enough to close the ticket, nothing that belongs to the patient.
 *
 * The clinician is told, in the same breath. A record leaving their chart
 * without their knowledge is exactly the kind of quiet admin action that makes
 * clinicians distrust a platform, and they may need to answer for it later.
 */
export async function emailPatientRecordToPatient(
  patientId: string,
  reason: string,
): Promise<AdminActionState & { sentTo?: string }> {
  const actor = await requireRole("super_admin");

  const explanation = reason.trim();
  if (explanation.length < 8) {
    return { error: "Say why. This is written into the audit trail and shown to the clinician." };
  }

  const { requestPatientExport, exportPath } = await import("@/lib/data/export");
  const result = await requestPatientExport(actor, patientId);
  if (!result.ok) return { error: result.error };

  const { sendRecordExport } = await import("@/lib/mail");
  const { env } = await import("@/lib/env");
  const { EXPORT_TTL_HOURS } = await import("@/lib/db/schema");

  const sent = await sendRecordExport({
    to: result.email,
    patientName: result.patientName,
    clinicianName: "your therapist",
    url: `${env.appUrl}${exportPath(result.token)}`,
    expiresInHours: EXPORT_TTL_HOURS,
  });

  if (!sent) return { error: "The link was created but the email was rejected." };

  await audit({
    actor,
    category: "admin",
    action: "patient.export_sent",
    resourceType: "patient",
    resourceId: patientId,
    reason: explanation.slice(0, 200),
  });

  return { ok: true, sentTo: result.email };
}

/* ------------------------------------------------------------- taxonomy -- */

/**
 * Switch a country, language or specialty off the radar.
 *
 * Off means "stop offering it", not "delete it". A clinician who already chose
 * a language that is now off keeps it on their profile and still appears — the
 * list controls what can be picked and filtered by, and pretending otherwise
 * would quietly hide working clinicians from patients who need them.
 */
export async function setTaxonomyState(
  kind: TaxonomyKind,
  code: string,
  enabled: boolean,
  reason: string,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");
  if (!TAXONOMY_KINDS.includes(kind)) return { error: "Unknown list." };
  // W2-A05: switching a country off takes its clinicians off the radar.
  const refused = await reasonRefused(reason);
  if (refused) return { error: refused };

  const { setTaxonomyEnabled } = await import("@/lib/data/taxonomy");
  await setTaxonomyEnabled(kind, code, enabled, actor.userId);

  await audit({
    actor,
    category: "admin",
    action: enabled ? "taxonomy.enable" : "taxonomy.disable",
    resourceType: "taxonomy",
    resourceId: `${kind}:${code}`,
    reason: reasonText(reason),
  });

  revalidatePath("/admin/taxonomy");
  revalidatePath("/radar");
  return { ok: true };
}

export async function addTaxonomy(kind: TaxonomyKind, label: string): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");
  if (!TAXONOMY_KINDS.includes(kind)) return { error: "Unknown list." };

  const { addTaxonomyEntry } = await import("@/lib/data/taxonomy");
  const result = await addTaxonomyEntry(kind, label, actor.userId);
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "admin",
    action: "taxonomy.add",
    resourceType: "taxonomy",
    resourceId: `${kind}:${label.trim()}`,
  });

  revalidatePath("/admin/taxonomy");
  revalidatePath("/radar");
  return { ok: true };
}

export async function removeTaxonomy(
  kind: TaxonomyKind,
  code: string,
  reason: string,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");
  if (!TAXONOMY_KINDS.includes(kind)) return { error: "Unknown list." };
  const refused = await reasonRefused(reason);
  if (refused) return { error: refused };

  const { removeTaxonomyEntry } = await import("@/lib/data/taxonomy");
  await removeTaxonomyEntry(kind, code);

  await audit({
    actor,
    category: "admin",
    action: "taxonomy.remove",
    resourceType: "taxonomy",
    resourceId: `${kind}:${code}`,
    reason: reasonText(reason),
  });

  revalidatePath("/admin/taxonomy");
  revalidatePath("/radar");
  return { ok: true };
}

/* --------------------------------------------------- radar command deck -- */

/**
 * Take a clinician off the radar and keep them off.
 *
 * Deliberately not the same thing as suspending their account. A clinician can
 * be unfit to take unscreened crisis calls from strangers this week and still
 * be perfectly fine seeing their own caseload — suspending the account punishes
 * their existing patients for something that has nothing to do with them.
 *
 * Hours of zero releases them.
 */
export async function setRadarSuspension(
  therapistUserId: string,
  hours: number,
  reason: string,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");

  const { suspendFromRadar, releaseFromRadarBan } = await import("@/lib/data/feedback");

  // 🔴 W2-A10: a ban and a release both carry a reason, at the length the screen asks for.
  const refused = await reasonRefused(reason);
  if (refused) return { error: refused };

  if (hours <= 0) {
    await releaseFromRadarBan(therapistUserId);
    await audit({
      actor,
      category: "admin",
      action: "radar.release",
      resourceType: "user",
      resourceId: therapistUserId,
      reason: reasonText(reason),
    });
  } else {
    const note = reasonText(reason);
    await suspendFromRadar(therapistUserId, hours, note);
    await audit({
      actor,
      category: "admin",
      action: "radar.suspend",
      resourceType: "user",
      resourceId: therapistUserId,
      reason: `${hours}h, ${note}`.slice(0, 200),
    });

    const [therapist] = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, therapistUserId))
      .limit(1);

    if (therapist) {
      await sendTherapistMessage({
        to: therapist.email,
        firstName: therapist.firstName,
        subject: "You have been taken off the Crisis Radar",
        body: `You are off the Crisis Radar for ${hours >= 24 * 365 ? "the time being" : `${hours} hours`}.\n\nReason given: ${note}\n\nYour own patients and everything in your portal are unaffected, this only stops new bookings from strangers on the radar. Reply to this email if you think it is wrong.`,
      });
    }
  }

  revalidatePath("/admin/radar");
  revalidatePath("/radar");
  return { ok: true };
}

/**
 * Force someone offline without a ban: the polite version, for a mistake.
 *
 * 🔴 W2-A10: it used to clear `pendingSessionId` and `reservedBy`, which
 * dropped a patient in the middle of booking this clinician with nothing to
 * tell them; their screen went on waiting for somebody who had been taken off
 * the board. Now a booking in flight is cancelled and the patient is told
 * (`forceOffline`), and the operator's reason is on the record.
 */
export async function forceRadarOffline(
  therapistUserId: string,
  reason: string,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");
  const refused = await reasonRefused(reason);
  if (refused) return { error: refused };

  const { forceOffline } = await import("@/lib/data/radar-admin");
  const { cancelledSessionId } = await forceOffline({ therapistUserId, adminUserId: actor.userId });

  await audit({
    actor,
    category: "admin",
    action: "radar.force_offline",
    resourceType: "user",
    resourceId: therapistUserId,
    reason: `${reasonText(reason)}${cancelledSessionId ? `, booking ${cancelledSessionId} cancelled and the patient told` : ""}`,
  });

  revalidatePath("/admin/radar");
  return { ok: true };
}

/**
 * Edit what a clinician is advertising.
 *
 * Support work, mostly: a headline with a phone number in it, a specialty
 * chosen by mistake, a country that is plainly wrong. Audited, and the
 * clinician can change it straight back — this is a correction, not a lock.
 */
export async function editRadarProfile(
  therapistUserId: string,
  input: { headline: string; country: string; region: string; city: string },
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");

  const { therapistRadar } = await import("@/lib/db/schema");
  await db
    .update(therapistRadar)
    .set({
      headline: input.headline.trim().slice(0, 240) || null,
      country: input.country.trim().slice(0, 2).toUpperCase() || null,
      region: input.region.trim().slice(0, 120) || null,
      city: input.city.trim().slice(0, 120) || null,
      updatedAt: new Date(),
    })
    .where(eq(therapistRadar.userId, therapistUserId));

  await audit({
    actor,
    category: "admin",
    action: "radar.edit_profile",
    resourceType: "user",
    resourceId: therapistUserId,
  });

  revalidatePath("/admin/radar");
  revalidatePath("/radar");
  return { ok: true };
}

/** Close a report with a decision that somebody's name is on. */
export async function resolveReport(
  reportId: string,
  outcome: "actioned" | "dismissed",
  resolution: string,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");

  const note = resolution.trim();
  if (note.length < 4) return { error: "Say what you decided." };

  const { sessionReports } = await import("@/lib/db/schema");
  await db
    .update(sessionReports)
    .set({
      status: outcome,
      resolution: note.slice(0, 1000),
      resolvedAt: new Date(),
      resolvedBy: actor.userId,
    })
    .where(eq(sessionReports.id, reportId));

  await audit({
    actor,
    category: "admin",
    action: `report.${outcome}`,
    resourceType: "session_report",
    resourceId: reportId,
    reason: note.slice(0, 200),
  });

  revalidatePath("/admin/radar");
  return { ok: true };
}

/* ------------------------------------------------- every template, once -- */

/**
 * 🔴 77.12 — SEND ALL FOURTEEN AUTOMATED EMAILS TO ONE TYPED ADDRESS.
 *
 * ## Why this is a console action and not a script
 *
 * `npm run mail:preview -- --send` was written to do exactly this and cannot,
 * because sending needs `RESEND_API_KEY` and on Vercel that variable is stored
 * as **sensitive**, which is write-only: not the dashboard, not the API, not
 * the person who typed it can read it back. The only process holding the key
 * is the deployed product, so the only place that can send is a page.
 *
 * ## What it is for
 *
 * Transactional email rots because looking at it is expensive. A footer that
 * says "sent by your therapist" on a message we sent ourselves, a link built
 * from a stale `APP_URL`, a layout that broke in Outlook nine months ago —
 * nobody finds those, because finding one means making the thing happen that
 * sends it. This makes looking cost one click.
 *
 * ## 🔴 The properties that make it safe to put on a page
 *
 *   - **One address, typed here.** No list, no roster, no database read.
 *     There is no code path in `lib/mail-previews.ts` that could reach a
 *     patient's inbox.
 *   - **Invented people only.** Surnames Demo and Example at the domain RFC
 *     2606 reserves. C127 has no preview exemption.
 *   - **Owner only, and written down.** `super_admin`, and an audit row naming
 *     the actor and the address, because "who made us send fourteen emails"
 *     is a question somebody will ask.
 *   - **Sequential.** Fourteen simultaneous sends is how a provider rate-limits
 *     you and half of them vanish, which is the same reasoning
 *     `announceToAllTherapists` above is built on.
 */
export async function sendEveryTemplate(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");

  /*
   * 🔴 `(previous, formData)` RATHER THAN `(to)`, so the form works with
   * JavaScript turned off.
   *
   * A `<form action={…}>` whose action is a client function wrapping this one
   * is not a server reference, so React cannot render the hidden fields that
   * carry the action id — and the form then does nothing at all without JS.
   * Taking the `useActionState` shape makes the reference direct, which is the
   * same arrangement `StaffSignInForm` already has and the reason that form
   * submits from a browser with scripting off.
   */
  const address = String(form.get("to") ?? "").trim().toLowerCase();
  /*
   * Deliberately loose. A validator that refuses a legal address is worse than
   * one that lets a typo through: the typo bounces and the person tries again,
   * and there is nothing here worth protecting from a malformed string.
   */
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { error: "That does not look like an email address." };
  }

  await audit({
    actor,
    category: "admin",
    action: "email.previewAll",
    resourceType: "user",
    resourceId: actor.userId,
    reason: address.slice(0, 200),
  });

  const { previewMessages } = await import("@/lib/mail-previews");
  const messages = previewMessages();

  /*
   * 🔴 PACED, AND THE FIRST VERSION WAS NOT — it sent 10 of 14.
   *
   * Resend allows ten requests a second and a bare `for` loop over fourteen
   * awaits clears that comfortably, so four came back "Too many requests" and
   * the four that vanished were the last four in the list — which is the worst
   * possible failure for a tool whose job is to show you every template.
   *
   * The warning is two functions up, on `announceToAllTherapists`, in a comment
   * about this exact provider. Writing the warning is not the same as heeding
   * it, and the reason it is worth saying twice is that the first version LOOKS
   * correct: it awaits each send, it counts them, and it reports an honest
   * number. It just reports the wrong one.
   *
   * 150ms between sends is under seven a second, and a rejection gets one
   * retry a second later, because a limit is a transient and dropping a
   * message on a transient is how a count becomes a lie.
   */
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let sent = 0;
  for (const [index, message] of messages.entries()) {
    if (index > 0) await pause(150);
    let ok = await message.send(address);
    if (!ok) {
      await pause(1_000);
      ok = await message.send(address);
    }
    if (ok) sent += 1;
  }

  log.info("every template sent", { to: address, sent, of: messages.length });

  if (sent === 0) {
    return { error: "Nothing was delivered. Email is not configured here." };
  }
  if (sent < messages.length) {
    return { error: `Only ${String(sent)} of ${String(messages.length)} were accepted.` };
  }
  return { ok: true };
}
