import { NextResponse } from "next/server";

import { printoutFor } from "@/lib/billing/eta/issue";
import { getSponsorActor } from "@/lib/sponsor-auth/session";

export const dynamic = "force-dynamic";

/**
 * 🔴 0147: the official ETA PDF of one of this company's own documents, fetched
 * from the Tax Authority on request and never stored. Scoped to the company in
 * the query, so a borrowed id returns nothing.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getSponsorActor();
  if (!actor) return new NextResponse("Sign in first.", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found.", { status: 404 });
  const pdf = await printoutFor(actor.sponsorId, id);
  if (!pdf) return new NextResponse("Not available yet.", { status: 404 });
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="eta-${id.slice(0, 8)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
