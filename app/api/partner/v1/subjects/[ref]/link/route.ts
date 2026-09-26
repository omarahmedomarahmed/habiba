import { NextResponse } from "next/server";

import { fail, withKey } from "@/lib/partner/route";
import { subjectLinkFor } from "@/lib/partner/subject-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 Board 932: a link the partner hands to its own patient.
 *
 * The patient opens it, signs in to their own account and confirms; only then
 * does the subject point at a person, and write-back and readers can answer.
 * The response is a URL and whether it has been confirmed, never who by.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const guard = await withKey(request, "session:write");
  if ("response" in guard) return guard.response;

  const { ref } = await params;
  const result = await subjectLinkFor({ key: guard.key, externalRef: decodeURIComponent(ref ?? "") });
  if ("error" in result) return fail(result.error, result.status);

  return NextResponse.json({ url: result.url, expires_at: result.expiresAt, linked: result.linked }, { status: 201 });
}
