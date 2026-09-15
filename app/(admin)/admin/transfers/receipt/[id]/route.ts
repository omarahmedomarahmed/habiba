import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireStaff } from "@/lib/auth/guard";
import { controlDb as db } from "@/lib/db";
import { manualPayments } from "@/lib/db/schema";
import { documentUrl } from "@/lib/uploads";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * 🔴 75.2 — OPENING A RECEIPT IS AN ACT SOMEBODY MAY LATER ASK ABOUT.
 *
 * ## Why this route exists rather than a link straight to the file
 *
 * A stored receipt is a Vercel Blob URL: an unguessable `https://` address
 * served by Vercel, which never touches this application. That is fine for
 * secrecy and useless for accountability. **A request that does not reach us
 * cannot be recorded by us**, so a queue that linked directly would have no
 * answer at all to "who looked at that payer's bank details".
 *
 * A receipt is a photograph of somebody's banking app. It carries their name,
 * often an account number, and sometimes the balance above the transfer. It is
 * not an identity document under a retention rule, so staff may read it: they
 * cannot do the job otherwise. But every read is recorded with a name on it.
 *
 * ## 🔴 What this does NOT claim
 *
 * An operator who copies the blob URL out of this redirect can open it again
 * without passing through here, and nothing would record that second read. This
 * route makes the **ordinary path** auditable, which is the path an operator
 * actually uses, and it is honest about being a record of that rather than a
 * lock. Signed, short-lived URLs are what would close it, and that is a real
 * piece of work rather than a line here.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  /*
   * 🔴 `requireStaff`, matching the queue this is reached from. The transfers
   * queue is deliberately not owner-only: somebody is on a waiting screen for
   * every row in it and it cannot wait for a founder to wake up.
   */
  const actor = await requireStaff();
  const { id } = await params;

  const [payment] = await db
    .select({
      id: manualPayments.id,
      proofUrl: manualPayments.proofUrl,
      reference: manualPayments.reference,
      purpose: manualPayments.purpose,
    })
    .from(manualPayments)
    .where(eq(manualPayments.id, id))
    .limit(1);

  const url = documentUrl(payment?.proofUrl);
  if (!url) {
    /* 404 rather than 403: a stranger learns nothing from the difference. */
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  /*
   * 🔴 AUDITED BEFORE THE REDIRECT, not after. A record written after the
   * handoff is a record that is missing exactly when the redirect failed, which
   * is the case somebody would be asking about.
   */
  await audit({
    actor,
    category: "billing",
    action: "transfer.receipt.opened",
    resourceType: "manual_payment",
    resourceId: payment!.id,
    reason: `Opened the receipt for a ${payment!.purpose} payment, reference ${payment!.reference || "none"}`,
  });

  return NextResponse.redirect(url, 302);
}
