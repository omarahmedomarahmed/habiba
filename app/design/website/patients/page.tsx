import type { Metadata } from "next";

import { PatientsPage } from "../_site/pages";

export const metadata: Metadata = { title: "Website: for you" };

export default function Page() {
  return <PatientsPage />;
}
