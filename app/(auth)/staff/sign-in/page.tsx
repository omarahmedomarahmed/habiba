import type { Metadata } from "next";
import { Suspense } from "react";

import { StaffSignInForm } from "@/components/auth/forms";

/**
 * 21R.1 / C94 — the back-office door.
 *
 * `noindex, nofollow`, and nothing on the public site links here: the header,
 * the footer and every marketing page point clinicians at /login and patients
 * at /patient/login. A verifier asserts that (see `verify:sprint21r`), because
 * "not linked" is the kind of property that decays the first time somebody adds
 * a helpful shortcut.
 */
export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

export default async function StaffSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <Suspense>
      <StaffSignInForm next={params.next} />
    </Suspense>
  );
}
