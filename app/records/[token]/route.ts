import { NextResponse } from "next/server";

import { openExport, renderExportHtml } from "@/lib/data/export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * A patient opening the link we emailed them.
 *
 * No login. The token in the URL is the credential — 32 random bytes, hashed
 * at rest, expiring in three days, and sent to one address that was already on
 * the chart. Asking a distressed person to create an account before they can
 * read their own notes would be a worse outcome than the marginal risk this
 * carries, and every failure mode below is indistinguishable from every other
 * on purpose.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const record = await openExport(token);

  if (!record) return gone();

  return new NextResponse(renderExportHtml(record, `/records/${token}/data.json`), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Never cached anywhere but the reader's own tab.
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow",
      // The document is self-contained, so nothing legitimate is blocked by
      // refusing every outbound request it could possibly make.
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function gone(): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>This link has expired</title></head>
<body style="margin:0;background:#f1f5f9;color:#0f172a;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:32rem;margin:0 auto;padding:64px 20px;text-align:center;">
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:32px 24px;">
    <h1 style="font-size:20px;margin:0 0 10px;">This link is no longer active</h1>
    <p style="color:#475569;margin:0 0 6px;">Links to a personal record expire after three days,
      and asking for a new copy replaces any older link.</p>
    <p style="color:#475569;margin:0;">Ask your therapist to send it again and a fresh one
      will arrive at the same address.</p>
  </div>
</div></body></html>`,
    {
      status: 410,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, private",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
