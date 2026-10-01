import { NextResponse } from "next/server";

import { EXPORT_OPEN_WINDOW_MINUTES } from "@/lib/db/schema";
import { exportLinkFor, openExport, renderExportHtml } from "@/lib/data/export";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * A patient opening the link we emailed them.
 *
 * No login. The token in the URL is the credential: 32 random bytes, hashed
 * at rest, sent to one address that was already on the chart. Many patients
 * have no account at all (a clinician's own file), so a sign-in cannot be the
 * gate.
 *
 * DD-2 B1: the link lives 24 hours and opens once. A GET only shows a button,
 * because mail scanners fetch links; pressing it (a POST) starts a window of
 * `EXPORT_OPEN_WINDOW_MINUTES` to read the page and download the JSON copy,
 * after which the link is spent. A forwarded or scanned email then reaches
 * nothing. Every failure looks the same on purpose.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const state = await exportLinkFor(token);
  if (state === "dead") return gone();
  if (state === "ready") return ready();
  /* Inside its window: a reload shows the record again. */
  return show(token, await openExport(token, { start: false }));
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  return show(token, await openExport(token, { start: true }));
}

async function show(token: string, record: Awaited<ReturnType<typeof openExport>>) {
  if (!record) return gone();

  const { egpRateMicro } = await import("@/lib/billing/manual");
  const rateMicro = await egpRateMicro().catch(() => 0);
  return new NextResponse(renderExportHtml(record, `/records/${token}/data.json`, rateMicro), {
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

const PAGE_STYLE =
  "margin:0;background:#f1f5f9;color:#0f172a;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";
const BUTTON_STYLE =
  "display:inline-block;background:#0f172a;color:#fff;border:0;border-radius:12px;padding:10px 18px;text-decoration:none;font:inherit;font-weight:600;cursor:pointer;";

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

async function page(input: { title: string; lines: string[]; action: string; status: number; csp: string }) {
  const { locale, dir } = await getI18n();
  const body = input.lines.map((line) => `<p style="color:#475569;margin:0 0 10px;">${esc(line)}</p>`).join("\n");
  return new NextResponse(
    `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(input.title)}</title></head>
<body style="${PAGE_STYLE}">
<div style="max-width:32rem;margin:0 auto;padding:64px 20px;text-align:center;">
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:32px 24px;">
    <h1 style="font-size:20px;margin:0 0 10px;">${esc(input.title)}</h1>
    ${body}
    ${input.action}
  </div>
</div></body></html>`,
    {
      status: input.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, private",
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": input.csp,
      },
    },
  );
}

/** Live and unopened: one button, which posts back to this same address. */
async function ready(): Promise<NextResponse> {
  const { t } = await getI18n();
  return page({
    title: t("records.ready.title"),
    lines: [t("records.ready.body", { minutes: EXPORT_OPEN_WINDOW_MINUTES })],
    action: `<form method="post" style="margin:20px 0 0;"><button type="submit" style="${BUTTON_STYLE}">${esc(t("records.ready.open"))}</button></form>`,
    status: 200,
    csp: "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  });
}

async function gone(): Promise<NextResponse> {
  const { t } = await getI18n();
  return page({
    title: t("records.gone.title"),
    lines: [t("records.gone.body"), t("records.gone.again")],
    action: `<a href="/patient/record" style="${BUTTON_STYLE}">${esc(t("records.gone.cta"))}</a>`,
    status: 410,
    csp: "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  });
}
