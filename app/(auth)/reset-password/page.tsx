import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/forms";
import { Button } from "@/components/ui";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Link not valid</h1>
        <p className="text-sm text-slate-600">
          This reset link is missing its token. Request a fresh one.
        </p>
        <Link href="/forgot-password">
          <Button full>Request a new link</Button>
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
