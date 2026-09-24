import type { Metadata } from "next";
import Link from "next/link";

import { WelcomeForm } from "@/components/auth/welcome-form";
import { Card } from "@/components/ui";
import { peekAccountLink } from "@/lib/auth/account-links";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "24Therapy", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-A06: where an emailed invitation or reset link lands.
 *
 * Capability auth, like `/join/[token]`: the token in the URL is the whole
 * credential, and a sign-in in front of it would be a sign-in in front of the
 * thing that creates the password. It reads nothing but the link row, and the
 * words are the ones every sign-in page already uses.
 */
export default async function WelcomePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [{ t }, link] = await Promise.all([getI18n(), peekAccountLink(token)]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Card className="p-5">
        {link ? (
          <>
            <h1 className="text-lg font-bold text-slate-900">{t("tauth.chooseNew")}</h1>
            <div className="mt-4">
              <WelcomeForm token={token} />
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-700">{t("nf.body")}</p>
            <Link href="/" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
              {t("tauth.backToSignIn")}
            </Link>
          </>
        )}
      </Card>
    </main>
  );
}
