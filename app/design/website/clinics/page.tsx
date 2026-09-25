import type { Metadata } from "next";

import { ClinicsPage } from "../_site/pages";
import { guardDesignGallery } from "../../_ds/guard";

export const metadata: Metadata = { title: "Website: for clinics" };

export default async function Page() {
  /* 🔴 0165: not found on the live deployment unless a super admin is looking. */
  await guardDesignGallery();
  return <ClinicsPage />;
}
