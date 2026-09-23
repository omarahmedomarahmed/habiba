import type { Metadata } from "next";

import { TherapistsPage } from "../_site/pages";

export const metadata: Metadata = { title: "Website: for therapists" };

export default function Page() {
  return <TherapistsPage />;
}
