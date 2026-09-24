import type { Metadata } from "next";
import QRCode from "qrcode";

import { CodeCard, CreateCode } from "@/components/sponsor/code-card";
import { Card } from "@/components/ui";
import { attemptsOnCode, liveCode, SPIKE_THRESHOLD } from "@/lib/data/sponsors";
import { env } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { requireSponsor } from "@/lib/sponsor-auth/guard";

export const metadata: Metadata = { title: "Your joining code", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The joining code and its poster. PLAN.md 53.9, 53.17, 53.18, C120, C237.
 *
 * ## 🔴 THE QR CARRIES THE SPONSOR'S IDENTITY ONLY
 *
 * It encodes `/patient/benefit?code=XXXX` and nothing else. No token, no
 * signature, no person, no expiry baked in. It authorises NOTHING on its own:
 * crossing the gate needs the identifier as well, and 53.18 requires the person to
 * be signed in already, so a code photographed off a wall by a stranger is worth
 * exactly what the wall is worth.
 *
 * That is why this can be printed and stuck up in a corridor at all, and it is why
 * a QR here is safe where a QR carrying a session or an invite would not be.
 *
 * ## 🔴 The QR is generated ON THE SERVER, into a data URI
 *
 * Not fetched from an image service. Handing a third party a URL containing our
 * customer's joining code, on every render, is a list of which organisations buy
 * therapy for their staff, assembled in somebody else's access log.
 *
 * ## 🔴 A dead code is answered with one sentence that names nothing (C120)
 *
 * Enforced in `lookupCode`, not here. This page only prints the live one, and
 * `liveCode` returns null rather than a revoked code, so a rotated code cannot
 * reappear on a poster because a page cached it.
 */
export default async function SponsorCodePage() {
  const actor = await requireSponsor();
  const { t } = await getI18n();

  const code = await liveCode(actor.sponsorId);
  /*
   * 🔴 53.19 — the spike, as a number, on the sponsor's own screen.
   *
   * *A spike alerting admin and the sponsor as a number, never names.* This is the
   * sponsor's half. It is on the code's own page because the remedy is on this page:
   * replacing the code is one tap and costs them a reprint.
   */
  const attempts = await attemptsOnCode(code);
  const url = code ? `${env.appUrl}/patient/benefit?code=${code}` : null;

  /*
   * Error correction level M and a modest margin: this is printed at A4 and
   * scanned from a metre away in corridor lighting, where a too-dense code with
   * no quiet zone is a code that does not scan and a poster nobody uses.
   */
  const qr = url
    ? await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 512 })
    : null;

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("sponsor.code")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("sponsor.codeBody")}</p>
      </div>

      {code && qr && url ? (
        <CodeCard
          code={code}
          qrDataUri={qr}
          /*
           * 🔴 The poster sentence is a MessageKey with the code interpolated, so
           * a printed poster is in the language the sponsor reads and an admin can
           * reword every poster in the product at once. A hardcoded English
           * sentence here would be the one string in sprint 53 that 45.8 does not
           * reach, and it would be the one that goes on a wall.
           */
          posterLine={t("sponsor.codePoster", { url: url.replace(/^https?:\/\//, ""), code })}
          canRotate={actor.role === "admin"}
          attempts={attempts}
          spike={attempts >= SPIKE_THRESHOLD}
        />
      ) : (
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-slate-600">{t("sponsor.codeNone")}</p>
          {/*
            W2-S03 — the company makes its own first code. This was a dead end:
            only an operator could mint one.
          */}
          {actor.role === "admin" ? <CreateCode /> : null}
        </Card>
      )}
    </div>
  );
}
