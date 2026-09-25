import { notFound } from "next/navigation";

import { profileFor } from "./profile";

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
  if (!(await profileFor(id))) notFound();
  return children;
}
