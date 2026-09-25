import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { requireStaff } from "@/lib/auth/guard";
import { controlDb as db } from "@/lib/db";
import { manualPayments } from "@/lib/db/schema";
import { documentUrl, fetchStored } from "@/lib/uploads";

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
 * ## 🔴 76.57 — IT STREAMS THE BYTES NOW, AND THE REDIRECT IS GONE
 *
 * The first version redirected 302 to the blob, and said so in its own header:
 * *"an operator who copies the blob URL out of this redirect can open it again
 * without passing through here, and nothing would record that second read."*
 * That was honest and it was still a hole, and the hole got wider the moment
 * the evidence went into a modal, because a modal showing an `<img>` whose
 * `src` resolves to a public blob puts that address in the page for anybody
 * with a developer console.
 *
 * So the file is fetched server-side and streamed back through this route. The
 * browser never learns where it is stored, every read passes through
 * `requireStaff`, and the audit row is the whole truth rather than a record of
 * the ordinary path.
 *
 * ## The two ways in, and they are recorded differently
 *
 * | | |
 * |---|---|
 * | no query | Inline. What the modal's `<img>` or `<object>` asks for |
 * | `?download=1` | An attachment with a filename. A copy that leaves the building |
 *
 * 🔴 **A download is a different act from a look**, so it is a different audit
 * action. Somebody reviewing six months of this wants to be able to ask which
 * receipts left, and one action name for both would make that unanswerable.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const download = new URL(request.url).searchParams.get("download") === "1";

  /*
   * 🔴 AUDITED BEFORE THE FETCH, not after. A record written after the handoff
   * is a record that is missing exactly when the handoff failed, which is the
   * case somebody would be asking about.
   */
  await audit({
    actor,
    category: "billing",
    action: download ? "transfer.receipt.downloaded" : "transfer.receipt.opened",
    resourceType: "manual_payment",
    resourceId: payment!.id,
    reason:
      `${download ? "Downloaded a copy of" : "Opened"} the receipt for a ${payment!.purpose} ` +
      `payment, reference ${payment!.reference || "none"}`,
  });

  /*
   * 🔴 A LOCALLY STORED RECEIPT IS A SAME-ORIGIN PATH, NOT AN ADDRESS.
   *
   * `documentUrl` returns `/api/uploads/...` when there is no blob token, which
   * is what a development database holds. `fetch` in Node refuses a relative
   * URL, so the first version of this streamed a 404 and the modal showed its
   * "the store could not produce it" branch over a file that was sitting on
   * disk. Found by opening the modal and looking at it: every check passed,
   * because nothing in a gate opens a picture.
   */
  const absolute = url.startsWith("http") ? url : new URL(url, request.url).toString();
  const upstream = await fetchStored(absolute, {
    cache: "no-store",
    /* The local route is behind the same guard, so the cookie has to travel. */
    headers: url.startsWith("http") ? {} : { cookie: request.headers.get("cookie") ?? "" },
  });
  if (!upstream.ok || !upstream.body) {
    /*
     * The row says there is a receipt and the store disagrees. That is worth
     * saying out loud on the screen rather than rendering a broken image: an
     * operator about to approve a payment needs to know the evidence is gone.
     */
    return NextResponse.json({ error: "unreadable" }, { status: 502 });
  }

  const type = upstream.headers.get("content-type") ?? "application/octet-stream";
  const extension = url.split(".").at(-1)?.split("?")[0] ?? "bin";
  const safeReference = (payment!.reference ?? "no-reference").replace(/[^a-zA-Z0-9._-]/g, "-");

  return new NextResponse(upstream.body, {
    headers: {
      "content-type": type,
      /*
       * 🔴 NEVER CACHED BY ANYTHING IN BETWEEN. A receipt carries an account
       * number, and a shared cache is a copy nobody audited.
       */
      "cache-control": "private, no-store, max-age=0",
      "content-disposition": download
        ? `attachment; filename="receipt-${safeReference}-${payment!.id.slice(0, 8)}.${extension}"`
        : "inline",
    },
  });
}
