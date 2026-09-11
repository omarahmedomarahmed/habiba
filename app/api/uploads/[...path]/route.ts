import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";

import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/guard";
import { localUploadAllowed } from "@/lib/documents/identity-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve a credential document stored on the local disk.
 *
 * Exists only alongside the fallback in `lib/uploads.ts`, under exactly the
 * same two conditions: no Vercel Blob token, and ALLOW_LOCAL_UPLOADS set on
 * purpose. Anything else 404s, so the route cannot appear on a deployment that
 * did not ask for it.
 *
 * The Blob URL this stands in for has one property that matters — it carries
 * 24 random bytes, so the URL *is* the access control. A path served off the
 * app's own origin does not get that for free, since a logged-out visitor
 * could try walking it. So this asks who is calling and refuses anyone who is
 * not signed in.
 */
const ENABLED =
  !process.env.BLOB_READ_WRITE_TOKEN && process.env.ALLOW_LOCAL_UPLOADS === "1";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!ENABLED) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  /*
   * 🔴 29.1 — "signed in" was the bar, and it was the wrong one.
   *
   * This route said: a clinician has to be able to see the licence they just
   * uploaded, and an admin has to review it. Both true, and neither is what
   * `requireUser()` checks. What it actually allowed was **any** signed-in
   * clinician reading **any other** clinician's passport by walking a path,
   * on any deployment with the local fallback switched on.
   *
   * Development-only, and that is not a defence: a development-only hole is
   * the one that gets copied into the real thing. It now asks the same
   * question the blob route asks, from the same module, so the two cannot
   * drift apart.
   */
  const actor = await requireUser();

  const { path } = await params;
  const rel = normalize(path.join("/"));
  if (rel.startsWith("..") || rel.includes("\0")) {
    return NextResponse.json({ error: "bad_path" }, { status: 400 });
  }

  if (!localUploadAllowed(rel, actor)) {
    /* 404 rather than 403: a stranger learns nothing from the difference. */
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const file = await readFile(join(process.cwd(), ".uploads", rel));
    const ext = rel.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "content-type": TYPES[ext] ?? "application/octet-stream",
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
