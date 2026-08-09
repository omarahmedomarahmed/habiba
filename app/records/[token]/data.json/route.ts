import { NextResponse } from "next/server";

import { openExport } from "@/lib/data/export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The same record, machine-readable.
 *
 * Data-portability rules ask for a "structured, commonly used, machine-readable
 * format", and a printed page is none of those. Same token, same expiry, same
 * silence about why a bad one failed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const record = await openExport(token);

  if (!record) {
    return NextResponse.json(
      { error: "This link is no longer active." },
      { status: 410, headers: { "Cache-Control": "no-store, private" } },
    );
  }

  const filename = `24therapy-record-${record.patient.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "export"}.json`;

  return new NextResponse(JSON.stringify(record, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}
