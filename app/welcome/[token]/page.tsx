import type { Metadata } from "next";
import Link from "next/link";

import { WelcomeForm } from "@/components/auth/welcome-form";
import { Card } from "@/components/ui";
import { PASSWORD_MIN_FOR, SIGN_IN_FOR, deadAccountLink, peekAccountLink } from "@/lib/auth/account-links";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "24Therapy", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-A06: where an emailed invitation or reset link lands.
 *
 * Capability auth, like `/join/[token]`: the token in the URL is the whole
 * credential, and a sign-in in front of it would be a sign-in in front of the
 * thing that creates the password. It reads nothing but the link row.
 *
 * 🔴 B29 / B43 / B48: an invitation is a FIRST password, so it says so, and the
 * rule under the field is the portal's own (twelve for a company or a
 * developer). A link that no longer works says whether it was used or ran
 * out, and sends them to their own portal's door rather than the home page.
 */
export default async function WelcomePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [{ t }, link] = await Promise.all([getI18n(), peekAccountLink(token)]);
  const dead = link ? null : await deadAccountLink(token);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Card className="p-5">
        {link ? (
          <>
            <h1 className="text-lg font-bold text-slate-900">
              {link.purpose === "invite" ? t("welcome.firstTitle") : t("tauth.chooseNew")}
            </h1>
            <div className="mt-4">
              <WelcomeForm
                token={token}
                first={link.purpose === "invite"}
                minimum={PASSWORD_MIN_FOR[link.audience]}
              />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-slate-900">
              {dead?.reason === "used"
                ? t("welcome.usedTitle")
                : dead?.reason === "expired"
                  ? t("welcome.expiredTitle")
                  : t("welcome.unknownTitle")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {dead?.reason === "used"
                ? t("welcome.usedBody")
                : dead?.reason === "expired"
                  ? t("welcome.expiredBody")
                  : t("nf.body")}
            </p>
            <Link
              href={dead ? SIGN_IN_FOR[dead.audience] : "/"}
              className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline"
            >
              {dead ? t("welcome.goSignIn") : t("tauth.backToSignIn")}
            </Link>
          </>
        )}
      </Card>
    </main>
  );
}
