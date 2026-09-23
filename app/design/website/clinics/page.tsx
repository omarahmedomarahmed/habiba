import type { Metadata } from "next";

import { ClinicsPage } from "../_site/pages";

export const metadata: Metadata = { title: "Website: for clinics" };

export default function Page() {
  return <ClinicsPage />;
}
