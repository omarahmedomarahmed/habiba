"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import { discountInvoice, setUpcomingDiscount } from "@/lib/billing/service";
import { setUserStatus, setVerification } from "@/lib/data/admin";
import { safeImageUrl } from "@/lib/content/url";
import { db } from "@/lib/db";
import { contentPages, type ContentBlock } from "@/lib/db/schema";

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
