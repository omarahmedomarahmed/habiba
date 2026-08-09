import type { Metadata } from "next";
import { Suspense } from "react";

import { SignInForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const NOTICES: Record<string, string> = {
  reset: "Your password has been updated. Sign in with your new password.",
  changed: "Password changed. Please sign in again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; changed?: string }>;
}) {
  const params = await searchParams;
  const notice = params.reset ? NOTICES.reset : params.changed ? NOTICES.changed : undefined;

  return (
    <Suspense>
      <SignInForm next={params.next} notice={notice} />
    </Suspense>
  );
}
