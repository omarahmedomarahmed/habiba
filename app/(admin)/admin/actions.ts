"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import { refundSessionPayment } from "@/lib/billing/connect";
import { discountInvoice, setUpcomingDiscount } from "@/lib/billing/service";
import { allTherapistRecipients, setUserStatus, setVerification } from "@/lib/data/admin";
import { safeImageUrl } from "@/lib/content/url";
import { db } from "@/lib/db";
import { contentPages, invoices, users, type ContentBlock } from "@/lib/db/schema";
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
  await setVerification(userId, status);
  await audit({
    actor,
    category: "admin",
    action: `user.verification.${status}`,
    resourceType: "user",
    resourceId: userId,
  });
  revalidatePath("/admin/therapists");
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
