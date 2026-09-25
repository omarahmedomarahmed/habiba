import type { Metadata } from "next";

import { CompaniesPage } from "../_site/pages";
import { guardDesignGallery } from "../../_ds/guard";

export const metadata: Metadata = { title: "Website: for companies" };

export default async function Page() {
  /* 🔴 0165: not found on the live deployment unless a super admin is looking. */
  await guardDesignGallery();
  return <CompaniesPage />;
}
