import { notFound } from "next/navigation";

import { MoneyDisplayProvider } from "@/components/money/display";

import { publicProfile } from "./profile";

/**
 * 🔴 B35: A PROFILE THAT DOES NOT EXIST IS A 404, DECIDED ABOVE THE BOUNDARY.
 *
 * `loading.tsx` beside this file puts a Suspense boundary around the page, so
 * a `notFound()` from the page arrives after the response has started with a
 * 200. This layout sits above that boundary, so its `notFound()` is decided
 * before anything streams and the status is a real 404.
 */
export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await publicProfile(id))) notFound();
  /* 🔴 Board 968: a clinician's page is where a session is booked, so pounds lead, as on /radar. */
  return <MoneyDisplayProvider primary="EGP">{children}</MoneyDisplayProvider>;
}
