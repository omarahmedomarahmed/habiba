import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import QRCode from "qrcode";

import { Card } from "@/components/ui";
import { WallCodeList, NewWallCode } from "@/components/settings/wall-codes";
import { requireUser } from "@/lib/auth/guard";
import { listCodes } from "@/lib/data/therapist-codes";

export const metadata: Metadata = { title: "Your QR code", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The clinic-wall codes. PLAN.md 25.17, C120.
 *
 * ## The QR is rendered on the server, as SVG
 *
 * Not a client library, and not an image service. A code in a page is printed,
 * and a printed QR that came from a third-party URL stops scanning the day
 * that service changes. An inline SVG is in the HTML, prints at any size, and
 * costs nothing at render time.
 */
export default async function WallCodesPage() {
  const actor = await requireUser();
  const codes = await listCodes(actor);

  const withSvg = await Promise.all(
    codes.map(async (code) => ({
      ...code,
      createdAt: code.createdAt.toISOString(),
      revokedAt: code.revokedAt?.toISOString() ?? null,
      svg: code.revokedAt
        ? null
        : await QRCode.toString(code.url, {
            type: "svg",
            margin: 1,
            errorCorrectionLevel: "M",
          }),
    })),
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8 sm:px-6">
      <Link
        href="/settings"
        className="flex w-fit items-center gap-1 text-sm font-medium text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Settings
      </Link>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Your QR code</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          For the wall, the desk, or the end of an in-person session. Somebody scans it, creates
          their own account, and can then take ownership of the notes you keep about them.
        </p>
      </div>

      <Card className="border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">What it carries</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Only you. It names you and your practice and nothing else, because a poster on a wall is
          public and anybody walking past can photograph it. It cannot identify a patient, and
          scanning it does not give anybody access to anything: matching a record still needs a
          confirmed phone number or email, and the name question.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Revoke a code when the poster it is on goes out of date. Scanning a revoked code says so,
          rather than failing.
        </p>
      </Card>

      <NewWallCode />
      <WallCodeList codes={withSvg} />
    </main>
  );
}
