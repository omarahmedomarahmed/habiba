"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import { refundSessionPayment } from "@/lib/billing/connect";
import { discountInvoice, setUpcomingDiscount } from "@/lib/billing/service";
import { allTherapistRecipients, setUserStatus, setVerification } from "@/lib/data/admin";
import { decideVerification } from "@/lib/data/verification";
import { safeImageUrl } from "@/lib/content/url";
import { db } from "@/lib/db";
import {
  contentPages,
  invoices,
  users,
  TAXONOMY_KINDS,
  type ContentBlock,
  type TaxonomyKind,
} from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { sendTherapistMessage } from "@/lib/mail";

export type AdminActionState = { error?: string; ok?: boolean };

export async function suspendUser(userId: string, suspend: boolean): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");
  await setUserStatus(userId, suspend ? "suspended" : "active");
  await audit({
    actor,
    category: "admin",
    action: suspend ? "user.suspend" : "user.reinstate",
    resourceType: "user",
    resourceId: userId,
  });
  revalidatePath("/admin/therapists");
  return { ok: true };
}

export async function verifyUser(
  userId: string,
  status: "verified" | "rejected" | "pending",
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");
  await setVerification(userId, status, actor.userId);
  await audit({
    actor,
    category: "admin",
    action: `user.verification.${status}`,
    resourceType: "user",
    resourceId: userId,
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

  const [page] = await db
    .update(contentPages)
    .set({
      title: input.title.trim(),
      description: input.description.trim() || null,
      status: input.status,
      blocks,
      publishedAt: input.status === "published" ? new Date() : null,
      updatedBy: actor.userId,
      updatedAt: new Date(),
    })
    .where(eq(contentPages.id, pageId))
    .returning({ slug: contentPages.slug });

  await audit({
    actor,
    category: "admin",
    action: "content.save",
    resourceType: "content_page",
    resourceId: pageId,
  });

  // Publish should be visible immediately rather than at the next revalidation.
  if (page?.slug) {
    revalidatePath(page.slug === "home" ? "/" : `/${page.slug}`);
  }
  revalidatePath("/admin/content");
  return { ok: true };
}

const TEXT_KEYS = new Set([
  "eyebrow",
  "heading",
  "body",
  "ctaLabel",
  "ctaHref",
  "demo",
  "icon",
  "title",
  "q",
  "a",
]);

/** Image URLs get their own rule — see `safeImageUrl`. */
const URL_KEYS = new Set(["backgroundImage"]);

function sanitiseBlocks(raw: unknown): ContentBlock[] | null {
  if (!Array.isArray(raw)) return null;

  const clean: ContentBlock[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const block = entry as Record<string, unknown>;
    const type = block.type;

    if (
      type !== "hero" &&
      type !== "prose" &&
      type !== "features" &&
      type !== "showcase" &&
      type !== "faq" &&
      type !== "cta"
    ) {
      return null;
    }

    const output: Record<string, unknown> = { type };

    for (const [key, value] of Object.entries(block)) {
      if (key === "type") continue;
      if (key === "items") {
        if (!Array.isArray(value)) return null;
        output.items = value.map((item) => {
          const source = (item ?? {}) as Record<string, unknown>;
          const target: Record<string, string> = {};
          for (const [k, v] of Object.entries(source)) {
            if (TEXT_KEYS.has(k) && typeof v === "string") target[k] = v.slice(0, 4000);
          }
          return target;
        });
        continue;
      }
      if (URL_KEYS.has(key)) {
        const safe = safeImageUrl(value);
        if (safe) output[key] = safe;
        continue;
      }
      if (TEXT_KEYS.has(key) && typeof value === "string") {
        output[key] = value.slice(0, 8000);
      }
    }

    clean.push(output as ContentBlock);
  }

  return clean;
}


/**
 * Discount an issued invoice.
 *
 * The amount is clamped server-side: a discount larger than the bill would make
 * the payable total negative and the ledger meaningless. A full discount
 * settles the invoice rather than leaving a zero-value bill sitting as "due".
 */
export async function applyInvoiceDiscount(
  invoiceId: string,
  discountCents: number,
  reason: string,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");

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
    reason: `${discountCents} cents — ${reason}`,
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
    reason: `${recipients.length} recipients — ${subject.trim().slice(0, 160)}`,
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
  const actor = await requireRole("super_admin");

  const trimmed = note.trim();
  if (!approve && !trimmed) {
    return { error: "Say what is wrong — they see this word for word." };
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

  await audit({
    actor,
    category: "admin",
    action: approve ? "verification.approve" : "verification.reject",
    resourceType: "verification",
    resourceId: verificationId,
    reason: trimmed || "approved",
  });

  const [person] = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, decided.userId))
    .limit(1);

  if (person) {
    after(() =>
      sendTherapistMessage({
        to: person.email,
        firstName: person.firstName,
        subject: approve ? "You are verified on 24Therapy" : "We need something else from you",
        body: approve
          ? `Your practice has been verified. You can start sessions, go on the Crisis Radar and take payments from patients right away.\n\nYour first completed session is on us.`
          : `We could not verify your practice yet.\n\n${trimmed}\n\nSign in and update your details — it goes straight back to the front of our queue.`,
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

  const trimmedReason = reason.trim();
  if (!trimmedReason) return { error: "Say why — this ends up in the audit log." };

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
    reason: `${JSON.stringify(patch)} — ${trimmedReason}`,
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
  if (!trimmed) return { error: "Say why — this ends up in the audit log." };

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

/** Credit applied to a subscriber's next renewal, consumed once. */
export async function applyUpcomingDiscount(
  organizationId: string,
  discountCents: number,
  reason: string,
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");

  await setUpcomingDiscount({ organizationId, discountCents, reason });

  await audit({
    actor,
    category: "billing",
    action: "subscription.upcoming_discount",
    resourceType: "organization",
    resourceId: organizationId,
    reason: `${discountCents} cents — ${reason}`,
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
    return { error: "Say why — this is written into the audit trail and shown to the clinician." };
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
): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");
  if (!TAXONOMY_KINDS.includes(kind)) return { error: "Unknown list." };

  const { setTaxonomyEnabled } = await import("@/lib/data/taxonomy");
  await setTaxonomyEnabled(kind, code, enabled, actor.userId);

  await audit({
    actor,
    category: "admin",
    action: enabled ? "taxonomy.enable" : "taxonomy.disable",
    resourceType: "taxonomy",
    resourceId: `${kind}:${code}`,
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

export async function removeTaxonomy(kind: TaxonomyKind, code: string): Promise<AdminActionState> {
  const actor = await requireRole("super_admin");
  if (!TAXONOMY_KINDS.includes(kind)) return { error: "Unknown list." };

  const { removeTaxonomyEntry } = await import("@/lib/data/taxonomy");
  await removeTaxonomyEntry(kind, code);

  await audit({
    actor,
    category: "admin",
    action: "taxonomy.remove",
    resourceType: "taxonomy",
    resourceId: `${kind}:${code}`,
  });

  revalidatePath("/admin/taxonomy");
  revalidatePath("/radar");
  return { ok: true };
}
