import type { Metadata } from "next";
import { Suspense } from "react";

import { SignInForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const NOTICES: Record<string, string> = {
  reset: "Your password has been updated. Sign in with your new password.",
  changed: "Password changed. Please sign in again.",
  // Arriving from /session-expired, which has already revoked the session and
  // deleted the cookie. Saying so is the difference between "the app is broken"
  // and "I have been away a while".
  expired: "You were signed out after a period of inactivity. Sign in to pick up where you left off.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; changed?: string; expired?: string }>;
}) {
  const params = await searchParams;
  const notice = params.reset
    ? NOTICES.reset
    : params.changed
      ? NOTICES.changed
      : params.expired
        ? NOTICES.expired
        : undefined;

  return (
    <Suspense>
      <SignInForm next={params.next} notice={notice} />
    </Suspense>
  );
}
